"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ActivityLog } from "@/components/ActivityLog";
import { Ga4TaskClick } from "@/components/Ga4TaskClick";
import { formatDuration, formatDurationLong } from "@/lib/format";
import { resolveActivityDisplay } from "@/lib/activity-display";
import { sendTrackBeacon } from "@/lib/track-client";
import { getHostname, isExternalUrl, isOnTaskTarget } from "@/lib/url";

type SessionInfo = {
  click_id: string;
  session_token: string;
  target_url: string;
  completion_status: string;
  required_duration_seconds: number;
  tracking_mode?: string;
  task: { id: string; title: string; campaign_name?: string | null };
};

type ActivityItem = {
  event_type: string;
  label?: string | null;
  page_url?: string | null;
  url_label?: string;
  occurred_at?: string;
  duration_seconds?: number | null;
};

type Props = {
  sessionToken: string;
  visitor: { id: string; label: string };
  taskId?: string;
};

type Metrics = {
  visible_duration_seconds: number;
  active_duration_seconds: number;
  focused_duration_seconds: number;
  external_duration_seconds: number;
  interaction_count: number;
  click_count: number;
  scroll_count: number;
  keypress_count: number;
  blur_count: number;
  manual_interaction_count: number;
};

const HEARTBEAT_MS = 15000;
const IDLE_MS = 45000;

function emptyMetrics(): Metrics {
  return {
    visible_duration_seconds: 0,
    active_duration_seconds: 0,
    focused_duration_seconds: 0,
    external_duration_seconds: 0,
    interaction_count: 0,
    click_count: 0,
    scroll_count: 0,
    keypress_count: 0,
    blur_count: 0,
    manual_interaction_count: 0,
  };
}

export function TaskWorkSession({ sessionToken, visitor, taskId }: Props) {
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [externalMode, setExternalMode] = useState(false);
  const [externalOpened, setExternalOpened] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState<{ status: string; summary: string } | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityItem[]>([]);
  const [tick, setTick] = useState(0);
  const [lastExternalHostname, setLastExternalHostname] = useState<string | null>(null);

  const metricsRef = useRef<Metrics>(emptyMetrics());
  const pendingEventsRef = useRef<Array<{ event_type: string; label?: string; payload?: Record<string, unknown> }>>([]);
  const lastActiveAtRef = useRef(Date.now());
  const isFocusedRef = useRef(true);
  const externalOpenedRef = useRef(false);
  const activeSiteUrlRef = useRef<string | null>(null);
  const wasHiddenRef = useRef(false);
  const finalizedRef = useRef(false);
  const externalModeLoggedRef = useRef(false);

  const buildEventPayload = useCallback(
    (event_type: string, extra?: Record<string, unknown>) => {
      const payload: Record<string, unknown> = {
        source: "dashboard",
        task_target_url: session?.target_url,
        ...extra,
      };

      if (event_type === "open_external_tab") {
        payload.external_url = session?.target_url;
        payload.page_url = session?.target_url;
        return payload;
      }

      if (typeof window !== "undefined") {
        payload.page_url = window.location.href;
      }

      if (
        externalMode &&
        (event_type === "window_blur" || event_type === "visibility_hidden")
      ) {
        payload.task_target_url = session?.target_url;
        const extUrl = activeSiteUrlRef.current;
        if (extUrl) {
          payload.external_url = extUrl;
          payload.site_known = true;
          payload.on_task_target = isOnTaskTarget(extUrl, session?.target_url || "");
        } else {
          payload.outside_task = true;
          payload.site_known = false;
        }
      }

      return payload;
    },
    [session?.target_url, externalMode]
  );

  const pushEvent = useCallback(
    (event_type: string, label?: string, extraPayload?: Record<string, unknown>) => {
      metricsRef.current.interaction_count += 1;
      const payload = buildEventPayload(event_type, extraPayload);
      pendingEventsRef.current.push({ event_type, label, payload });

      const display = resolveActivityDisplay(
        event_type,
        JSON.stringify(payload),
        session?.target_url || ""
      );

      setActivityLog((prev) =>
        [
          {
            event_type,
            label,
            page_url: display.page_url,
            url_label: display.url_label,
            occurred_at: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 50)
      );
    },
    [buildEventPayload, session?.target_url]
  );

  const getMetrics = useCallback((): Metrics => ({ ...metricsRef.current }), []);
  const getTotalEngaged = useCallback(
    () => metricsRef.current.active_duration_seconds + metricsRef.current.external_duration_seconds,
    []
  );

  const sendHeartbeatRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const sendHeartbeat = useCallback(async () => {
    if (finalizedRef.current) return;
    const events = [...pendingEventsRef.current];
    pendingEventsRef.current = [];
    await fetch("/api/track/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_token: sessionToken,
        metrics: getMetrics(),
        events,
      }),
      keepalive: true,
    });
  }, [getMetrics, sessionToken]);

  sendHeartbeatRef.current = sendHeartbeat;

  const finishSession = useCallback(
    async (reason: string) => {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      setFinishing(true);

      await sendHeartbeat();

      const res = await fetch("/api/track/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_token: sessionToken,
          metrics: getMetrics(),
          reason,
        }),
        keepalive: true,
      });

      const data = await res.json().catch(() => ({}));
      setFinishing(false);

      if (res.ok) {
        setFinished({
          status: data.completion_status,
          summary: data.summary ?? "",
        });
      } else {
        setError(data.error ?? "تعذر إنهاء الجلسة");
        finalizedRef.current = false;
      }
    },
    [getMetrics, sendHeartbeat, sessionToken]
  );

  useEffect(() => {
    fetch(`/api/track/session/${sessionToken}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "تعذر تحميل الجلسة");
        return body as SessionInfo;
      })
      .then((body) => {
        setSession(body);
        const external =
          body.tracking_mode === "external" || isExternalUrl(body.target_url);
        setExternalMode(external);
        if (external && !externalModeLoggedRef.current) {
          externalModeLoggedRef.current = true;
          pushEvent("external_mode", `وضع الموقع الخارجي: ${getHostname(body.target_url)}`, {
            external_url: body.target_url,
          });
        }
      })
      .catch((err: Error) => setError(err.message));
  }, [sessionToken, pushEvent]);

  useEffect(() => {
    if (!session || session.completion_status !== "in_progress") return;

    const poll = () => {
      fetch(`/api/track/session/${sessionToken}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data?.recent_activities) return;
          setActivityLog(
            data.recent_activities.map((a: ActivityItem) => ({
              event_type: a.event_type,
              label: a.label,
              page_url: a.page_url,
              url_label: a.url_label,
              occurred_at: a.occurred_at,
              duration_seconds: a.duration_seconds,
            }))
          );
          if (data.metrics?.click_count != null) {
            metricsRef.current.click_count = data.metrics.click_count;
          }
          const lastVisit = data.recent_activities.find(
            (a: ActivityItem) =>
              a.page_url &&
              (a.event_type?.startsWith("external_") || a.event_type === "open_external_tab")
          );
          if (lastVisit?.page_url) {
            activeSiteUrlRef.current = lastVisit.page_url;
            setLastExternalHostname(getHostname(lastVisit.page_url));
            externalOpenedRef.current = true;
            setExternalOpened(true);
          }
        })
        .catch(() => {});
    };

    poll();
    const timer = window.setInterval(poll, 3000);
    return () => clearInterval(timer);
  }, [session, sessionToken]);

  const openExternalSite = useCallback(() => {
    if (!session) return;
    externalOpenedRef.current = true;
    setExternalOpened(true);
    activeSiteUrlRef.current = session.target_url;
    pushEvent("open_external_tab", `فتح ${getHostname(session.target_url)} في تبويب جديد`, {
      external_url: session.target_url,
      page_url: session.target_url,
      on_task_target: true,
      site_known: true,
    });

    setLastExternalHostname(getHostname(session.target_url));

    const link = document.createElement("a");
    link.href = session.target_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [session, pushEvent]);

  useEffect(() => {
    if (!session || session.completion_status !== "in_progress") return;

    const onScroll = () => {
      lastActiveAtRef.current = Date.now();
    };

    const onPointer = () => {
      lastActiveAtRef.current = Date.now();
    };

    const onClick = () => {
      metricsRef.current.click_count += 1;
      pushEvent("click", "نقرة على لوحة المتابعة");
    };

    const onKeydown = () => {
      metricsRef.current.keypress_count += 1;
      lastActiveAtRef.current = Date.now();
    };

    const onBlur = () => {
      isFocusedRef.current = false;
      metricsRef.current.blur_count += 1;
      pushEvent(
        "window_blur",
        externalOpenedRef.current ? "انتقل لتبويب الموقع الخارجي" : "انتقل خارج الصفحة"
      );
    };

    const onFocus = () => {
      isFocusedRef.current = true;
      wasHiddenRef.current = false;
      pushEvent("window_focus", "عودة للوحة المتابعة");
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        wasHiddenRef.current = true;
        void sendHeartbeat();
      }
      pushEvent(
        document.visibilityState === "visible" ? "visibility_visible" : "visibility_hidden",
        document.visibilityState === "visible" ? "لوحة المتابعة ظاهرة" : "لوحة المتابعة مخفية"
      );
    };

    const onPageHide = () => {
      if (finalizedRef.current) return;
      const events = [...pendingEventsRef.current];
      pendingEventsRef.current = [];
      const metrics = getMetrics();
      sendTrackBeacon("/api/track/heartbeat", {
        session_token: sessionToken,
        metrics,
        events,
      });
      sendTrackBeacon("/api/track/finish", {
        session_token: sessionToken,
        metrics,
        reason: "page_leave",
      });
    };

    window.addEventListener("pointerdown", onPointer, { passive: true });
    window.addEventListener("touchstart", onPointer, { passive: true });
    window.addEventListener("touchmove", onPointer, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onPointer, { passive: true });
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKeydown);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    const timer = window.setInterval(() => {
      const hidden = document.visibilityState === "hidden";

      if (externalMode && hidden) {
        metricsRef.current.external_duration_seconds += 1;
      } else if (!hidden) {
        metricsRef.current.visible_duration_seconds += 1;
        if (isFocusedRef.current) {
          metricsRef.current.focused_duration_seconds += 1;
        }
        if (Date.now() - lastActiveAtRef.current <= IDLE_MS) {
          metricsRef.current.active_duration_seconds += 1;
        }
      }

      setTick((v) => v + 1);
    }, 1000);

    const heartbeat = window.setInterval(() => {
      void sendHeartbeat();
    }, HEARTBEAT_MS);

    window.addEventListener("pagehide", onPageHide);

    return () => {
      clearInterval(timer);
      clearInterval(heartbeat);
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("touchstart", onPointer);
      window.removeEventListener("touchmove", onPointer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onPointer);
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKeydown);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [session, externalMode, pushEvent, sendHeartbeat, finishSession, sessionToken, getMetrics]);

  const metrics = getMetrics();
  const totalEngaged = getTotalEngaged();
  const required = session?.required_duration_seconds ?? 0;
  const progress = required > 0 ? Math.min(100, (totalEngaged / required) * 100) : 0;

  useEffect(() => {
    if (!session || finalizedRef.current || finishing) return;
    if (required > 0 && totalEngaged >= required) {
      void finishSession("auto_complete");
    }
  }, [tick, session, required, finishing, finishSession, totalEngaged]);

  if (error) {
    return (
      <div className="work-shell">
        <div className="card" style={{ margin: 24 }}>
          <h1 className="page-title">خطأ</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="work-shell">
        <div className="work-loading">جاري تحميل جلسة العمل...</div>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="work-shell">
        <div className="card work-result">
          <h1 className="page-title">تم إنهاء المهمة</h1>
          <p>{finished.summary}</p>
          <p>
            الحالة:{" "}
            <strong>
              {finished.status === "completed"
                ? "مكتملة"
                : finished.status === "partial"
                  ? "جزئية"
                  : "غير مكتملة"}
            </strong>
          </p>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => router.push(taskId ? `/t/${taskId}` : "/")}
          >
            بدء من جديد
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="work-shell">
      <Ga4TaskClick
        clickId={session.click_id}
        taskId={session.task.id}
        visitorId={visitor.id}
        visitorLabel={visitor.label}
        campaignName={session.task.campaign_name}
        pageUrl={session.target_url}
      />

      <header className="work-header">
        <div>
          <strong>{session.task.title}</strong>
          <div className="muted" style={{ fontSize: 13 }}>
            المطلوب: {formatDurationLong(required)} | الفعلي: {formatDurationLong(totalEngaged)}
            {externalMode && externalOpened && (
              <> | على الموقع: {formatDuration(metrics.external_duration_seconds)}</>
            )}
          </div>
        </div>
        <div className="work-progress-wrap">
          <div className="work-progress-bar">
            <div className="work-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span>{Math.round(progress)}%</span>
        </div>
        <button
          className="btn btn-secondary"
          type="button"
          disabled={finishing}
          onClick={() => finishSession("manual_end")}
        >
          {finishing ? "جاري الحفظ..." : "إنهاء المهمة"}
        </button>
      </header>

      <div className={`work-body ${externalMode ? "work-body-external" : ""}`}>
        <main className="work-main">
          {externalMode ? (
            <div className="external-mode-panel card">
              <h2 style={{ marginTop: 0 }}>موقع خارجي — {getHostname(session.target_url)}</h2>

              <ol className="external-steps">
                <li>اضغط «بكجات سياحية» أدناه</li>
                <li>اقرأ المحتوى في التبويب الجديد</li>
                <li>
                  <strong>ارجع لهذه الصفحة</strong> من شريط التبويبات — يُحسب وقتك تلقائياً
                </li>
                <li>عند الانتهاء اضغط «إنهاء المهمة»</li>
              </ol>

              <button className="btn btn-primary btn-block" type="button" onClick={openExternalSite}>
                {externalOpened ? "بكجات سياحية " : "فتح بكجات سياحية"}
              </button>

              <p className="muted" style={{ marginTop: 12 }}>
                الموقع: {lastExternalHostname ?? getHostname(session.target_url)}
                {" · "}
                وقت خارج اللوحة: {formatDuration(metrics.external_duration_seconds)}
              </p>
            </div>
          ) : (
            <iframe
              className="work-iframe"
              src={session.target_url}
              title={session.task.title}
              onLoad={() => pushEvent("iframe_loaded", "تم تحميل الصفحة")}
            />
          )}
        </main>

        <aside className="work-sidebar card">
          <h3 style={{ marginTop: 0 }}>ملخص التفاعل</h3>
          <div className="work-stats">
            <Stat label="إجمالي الوقت" value={formatDuration(totalEngaged)} />
            <Stat label="على الموقع الخارجي" value={formatDuration(metrics.external_duration_seconds)} />
            <Stat label="على لوحة المتابعة" value={formatDuration(metrics.active_duration_seconds)} />
            <Stat label="خروج/عودة" value={String(metrics.blur_count)} />
            <Stat label="إجمالي الأحداث" value={String(metrics.interaction_count)} />
          </div>

          <h4>آخر الأحداث</h4>
          <ul className="work-log">
            <ActivityLog items={activityLog} emptyMessage="سيظهر النشاط هنا..." live />
          </ul>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="work-stat">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
