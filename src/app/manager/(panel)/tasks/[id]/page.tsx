"use client";

import { ActivityLog } from "@/components/ActivityLog";
import { StatusBadge } from "@/components/StatusBadge";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatDateTime, formatDurationLong } from "@/lib/format";

type VisitorSession = {
  click_id: string;
  started_at: string;
  ended_at: string | null;
  completion_status: string;
  completion_percent: number;
  engaged_seconds: number;
  engaged_label: string;
  tracking_mode: string;
  referer: string | null;
  is_valid: boolean;
  invalid_reason: string | null;
  summary: string;
};

type TaskReport = {
  task: {
    id: string;
    title: string;
    target_url: string;
    required_duration_label: string;
    public_url: string;
    visitor_count: number;
    unique_ip_count: number;
    shared_network_count: number;
    session_count: number;
    completed_visitors: number;
    in_progress_visitors: number;
  };
  ip_groups: Array<{
    ip_address: string;
    visitor_count: number;
    session_count: number;
    browsers: string[];
    shared_network: boolean;
    duplicate_browser: boolean;
    visitors: Array<{ display_name: string; browser: string | null; session_count: number }>;
  }>;
  visitors: Array<{
    visitor_id: string | null;
    display_name: string;
    visitor_label: string;
    ip_address: string | null;
    ip_group_key: string | null;
    same_ip_visitor_count: number;
    shared_ip: boolean;
    duplicate_browser_on_ip: boolean;
    registered_at: string;
    last_active_at: string;
    first_seen_on_task: string;
    last_seen_on_task: string;
    user_agent: string | null;
    browser: string | null;
    os: string | null;
    device_type: string | null;
    latest_referer: string | null;
    latest_tracking_mode: string | null;
    session_count: number;
    valid_session_count: number;
    invalid_session_count: number;
    completed_sessions: number;
    partial_sessions: number;
    in_progress_sessions: number;
    abandoned_sessions: number;
    total_engaged_seconds: number;
    total_engaged_label: string;
    sessions: VisitorSession[];
    legacy_user: {
      name: string;
      email: string;
      employee_code: string | null;
    } | null;
    latest_session: {
      completion_status: string;
      completion_percent: number;
      external_seconds: number;
      manual_interactions: number;
      active_seconds: number;
      visible_seconds: number;
      required_seconds: number;
      interaction_count: number;
      click_count: number;
      scroll_count: number;
      keypress_count: number;
      blur_count: number;
      tracking_mode: string;
      referer: string | null;
      user_agent: string | null;
      ip_address: string | null;
      summary: string;
      visited_sites: Array<{
        url: string;
        hostname: string;
        total_seconds: number;
        total_label: string;
        visit_count: number;
        employee_reported: boolean;
      }>;
      activities: Array<{
        event_type: string;
        label: string | null;
        page_url?: string | null;
        url_label?: string;
        duration_seconds?: number | null;
        occurred_at: string;
      }>;
    } | null;
  }>;
};

function trackingModeLabel(mode: string | null | undefined): string {
  if (mode === "external") return "موقع خارجي";
  if (mode === "embedded") return "داخل اللوحة";
  return mode ?? "—";
}

export default function ManagerTaskReportPage() {
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<TaskReport | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadReport() {
      try {
        const r = await fetch(`/api/manager/tasks/${params.id}`, { cache: "no-store" });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? "تعذر تحميل التقرير");
        }
        const data = await r.json();
        if (!cancelled) {
          setReport(data);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "تعذر تحميل التقرير");
        }
      }
    }

    setReport(null);
    setLoadError(null);
    void loadReport();

    const timer = window.setInterval(loadReport, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [params.id]);

  async function copyLink() {
    if (!report?.task.public_url) return;
    await navigator.clipboard.writeText(report.task.public_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loadError) {
    return (
      <div>
        <Link className="muted" href="/manager">
          ← العودة للوحة
        </Link>
        <div className="card" style={{ marginTop: 16 }}>
          <h1 className="page-title">تعذر تحميل التقرير</h1>
          <p>{loadError}</p>
          <Link className="btn btn-primary" href="/manager">
            العودة للوحة
          </Link>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div>
        <Link className="muted" href="/manager">
          ← العودة للوحة
        </Link>
        <p className="muted" style={{ marginTop: 16 }}>
          جاري تحميل تفاصيل المهمة...
        </p>
      </div>
    );
  }

  return (
    <div>
      <Link className="muted" href="/manager">
        ← العودة للوحة
      </Link>
      <h1 className="page-title" style={{ marginTop: 16 }}>
        {report.task.title}
      </h1>
      <p className="page-subtitle">
        المطلوب: {report.task.required_duration_label} | {report.task.target_url}
      </p>

      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-label">زوار فريدون (كوكيز)</div>
          <div className="stat-value">{report.task.visitor_count}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            كل متصفح/جهاز = كوكي منفصل
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">عناوين IP فريدة</div>
          <div className="stat-value">{report.task.unique_ip_count}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {report.task.visitor_count > report.task.unique_ip_count
              ? "شبكة مشتركة (مكتب / WiFi)"
              : "IP مختلف لكل زائر"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">IP مشتركة</div>
          <div className="stat-value">{report.task.shared_network_count}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            أكثر من زائر على نفس IP
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">إجمالي الجلسات</div>
          <div className="stat-value">{report.task.session_count}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">زوار أنجزوا / جاري</div>
          <div className="stat-value" style={{ fontSize: 22 }}>
            {report.task.completed_visitors} / {report.task.in_progress_visitors}
          </div>
        </div>
      </div>

      {report.ip_groups && report.ip_groups.length > 0 && (
        <section className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>تجميع حسب IP</h3>
          <p className="muted" style={{ fontSize: 14, marginBottom: 16 }}>
            نفس IP لا يعني نفس الشخص — المكتب والWiFi والشبكات المحمولة (CGNAT) تشارك عنواناً
            واحداً. العدد الدقيق للزوار = الكوكيز الفريدة أعلاه.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>IP</th>
                  <th>متصفحات</th>
                  <th>زوار (كوكيز)</th>
                  <th>جلسات</th>
                  <th>ملاحظة</th>
                </tr>
              </thead>
              <tbody>
                {report.ip_groups.map((group) => (
                  <tr key={group.ip_address}>
                    <td>
                      <strong>{group.ip_address}</strong>
                    </td>
                    <td>{group.browsers.length ? group.browsers.join("، ") : "—"}</td>
                    <td>{group.visitor_count}</td>
                    <td>{group.session_count}</td>
                    <td>
                      {group.duplicate_browser ? (
                        <span className="badge badge-warning">متصفح مكرر</span>
                      ) : group.shared_network ? (
                        <span className="badge badge-info">شبكة مشتركة</span>
                      ) : (
                        <span className="badge badge-success">زائر واحد</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <strong>رابط المشاركة</strong>
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <input className="input" readOnly value={report.task.public_url} style={{ flex: 1, minWidth: 220 }} />
          <button className="btn btn-secondary" type="button" onClick={copyLink}>
            {copied ? "تم النسخ" : "نسخ"}
          </button>
        </div>
      </div>

      {report.visitors.length === 0 ? (
        <div className="empty-state">لم يفتح أحد الرابط بعد.</div>
      ) : (
        report.visitors.map((row) => (
          <section className="card" key={row.visitor_id ?? row.visitor_label} style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <div>
                <strong style={{ fontSize: 18 }}>{row.display_name}</strong>
                {row.shared_ip && (
                  <span className="badge badge-info" style={{ marginInlineStart: 8 }}>
                    شبكة مشتركة ({row.same_ip_visitor_count} زائر)
                  </span>
                )}
                {row.duplicate_browser_on_ip && (
                  <span className="badge badge-warning" style={{ marginInlineStart: 8 }}>
                    نفس المتصفح مرتين على IP
                  </span>
                )}
                {row.latest_session && (
                  <span style={{ marginInlineStart: 8 }}>
                    <StatusBadge status={row.latest_session.completion_status} />
                  </span>
                )}
                <div className="muted" style={{ marginTop: 4 }}>
                  {row.session_count} جلسة · {row.total_engaged_label} · {row.ip_address ?? "IP ؟"}
                </div>
              </div>
            </div>

            <h4 style={{ marginTop: 0 }}>معلومات الزائر</h4>
            <div className="grid-3" style={{ marginBottom: 16 }}>
              <InfoItem label="أول زيارة للمهمة" value={formatDateTime(row.first_seen_on_task)} />
              <InfoItem label="آخر نشاط على المهمة" value={formatDateTime(row.last_seen_on_task)} />
              <InfoItem label="أول تسجيل في النظام" value={formatDateTime(row.registered_at)} />
              <InfoItem label="آخر ظهور في النظام" value={formatDateTime(row.last_active_at)} />
              <InfoItem label="المتصفح" value={row.browser ?? "—"} />
              <InfoItem label="نظام التشغيل" value={row.os ?? "—"} />
              <InfoItem label="نوع الجهاز" value={row.device_type ?? "—"} />
              <InfoItem label="عنوان IP" value={row.ip_address ?? "—"} />
              <InfoItem label="وضع التتبع" value={trackingModeLabel(row.latest_tracking_mode)} />
              <InfoItem
                label="مصدر الوصول"
                value={row.latest_referer ? truncateUrl(row.latest_referer) : "مباشر / غير معروف"}
              />
              {row.legacy_user && (
                <>
                  <InfoItem label="اسم (قديم)" value={row.legacy_user.name} />
                  <InfoItem label="البريد (قديم)" value={row.legacy_user.email} />
                </>
              )}
            </div>

            {row.user_agent && (
              <details style={{ marginBottom: 16 }}>
                <summary className="muted" style={{ cursor: "pointer" }}>
                  User-Agent كامل
                </summary>
                <p className="muted" style={{ fontSize: 12, marginTop: 8, wordBreak: "break-all" }}>
                  {row.user_agent}
                </p>
              </details>
            )}

            <h4>إحصائيات الجلسات</h4>
            <div className="grid-3" style={{ marginBottom: 16 }}>
              <MiniStat label="جلسات صالحة" value={String(row.valid_session_count)} />
              <MiniStat label="مكتملة" value={String(row.completed_sessions)} />
              <MiniStat label="جزئية" value={String(row.partial_sessions)} />
              <MiniStat label="قيد التنفيذ" value={String(row.in_progress_sessions)} />
              <MiniStat label="متروكة" value={String(row.abandoned_sessions)} />
              <MiniStat label="غير صالحة" value={String(row.invalid_session_count)} />
            </div>

            {row.sessions.length > 0 && (
              <>
                <h4>سجل الجلسات ({row.sessions.length})</h4>
                <div style={{ overflowX: "auto", marginBottom: 16 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>البدء</th>
                        <th>المدة</th>
                        <th>الحالة</th>
                        <th>الوضع</th>
                        <th>ملخص</th>
                      </tr>
                    </thead>
                    <tbody>
                      {row.sessions.map((session) => (
                        <tr key={session.click_id}>
                          <td>{formatDateTime(session.started_at)}</td>
                          <td>{session.engaged_label}</td>
                          <td>
                            <StatusBadge status={session.completion_status} />
                            {!session.is_valid && (
                              <span className="muted" style={{ fontSize: 11, display: "block" }}>
                                {session.invalid_reason ?? "غير صالحة"}
                              </span>
                            )}
                          </td>
                          <td>{trackingModeLabel(session.tracking_mode)}</td>
                          <td className="muted" style={{ fontSize: 13, maxWidth: 280 }}>
                            {session.summary}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {!row.latest_session ? (
              <p className="muted">لا توجد جلسة صالحة للعرض التفصيلي.</p>
            ) : (
              <>
                <h4>آخر جلسة — تفاصيل</h4>
                <p>
                  <strong>{row.latest_session.summary}</strong> —{" "}
                  {Math.round(row.latest_session.completion_percent)}%
                </p>

                <div className="grid-3" style={{ marginBottom: 16 }}>
                  <MiniStat
                    label="إجمالي الوقت"
                    value={formatDurationLong(
                      row.latest_session.active_seconds + (row.latest_session.external_seconds ?? 0)
                    )}
                  />
                  <MiniStat
                    label="وقت على الموقع الخارجي"
                    value={formatDurationLong(row.latest_session.external_seconds ?? 0)}
                  />
                  <MiniStat
                    label="تفاعلات مسجلة"
                    value={String(row.latest_session.manual_interactions ?? 0)}
                  />
                  <MiniStat
                    label="وقت على لوحة المتابعة"
                    value={formatDurationLong(row.latest_session.active_seconds)}
                  />
                  <MiniStat label="خروج/عودة" value={String(row.latest_session.blur_count)} />
                  <MiniStat label="إجمالي الأحداث" value={String(row.latest_session.interaction_count)} />
                </div>

                {row.latest_session.visited_sites?.length > 0 && (
                  <>
                    <h4>المواقع المسجّلة</h4>
                    <ul className="work-log" style={{ marginBottom: 16 }}>
                      {row.latest_session.visited_sites.map((site) => (
                        <li key={site.url}>
                          <div>
                            <strong>{site.hostname}</strong>
                            {site.employee_reported && (
                              <span className="badge badge-info" style={{ marginInlineStart: 8 }}>
                                تلقائي
                              </span>
                            )}
                            <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                              {site.url}
                            </div>
                          </div>
                          <span className="muted activity-log-meta">
                            {site.total_label}
                            {site.visit_count > 0 && <> · {site.visit_count} زيارة</>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                <h4>سجل النشاط</h4>
                {row.latest_session.activities.length === 0 ? (
                  <p className="muted">لا توجد أحداث مسجلة.</p>
                ) : (
                  <ul className="work-log">
                    <ActivityLog
                      items={row.latest_session.activities}
                      live={row.latest_session.completion_status === "in_progress"}
                    />
                  </ul>
                )}
              </>
            )}
          </section>
        ))
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="work-stat">
      <span className="muted">{label}</span>
      <strong style={{ fontSize: 14, wordBreak: "break-word" }}>{value}</strong>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="work-stat">
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function truncateUrl(url: string, max = 60): string {
  if (url.length <= max) return url;
  return `${url.slice(0, max)}…`;
}
