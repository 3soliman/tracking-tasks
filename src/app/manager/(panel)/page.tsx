"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format";

type Dashboard = {
  summary: {
    visitors: number;
    total_tasks: number;
    completed: number;
    partial: number;
    in_progress: number;
    abandoned: number;
    valid_clicks: number;
    suspicious_clicks: number;
  };
  recent_tasks: Array<{
    id: string;
    title: string;
    target_url: string;
    created_at: string;
    public_url: string;
    visitor_count: number;
    unique_ip_count: number;
    possible_shared_network: boolean;
    completed_visitor_count: number;
    session_count: number;
    in_progress_count: number;
    report_url: string;
  }>;
};

export default function ManagerDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const r = await fetch("/api/manager/dashboard", { cache: "no-store" });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error ?? "تعذر تحميل البيانات");
        }
        const json = await r.json();
        if (!cancelled) {
          setData(json);
          setLoadError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "تعذر تحميل البيانات");
        }
      }
    }

    void loadDashboard();
    const timer = window.setInterval(loadDashboard, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (loadError) {
    return (
      <div className="card">
        <p className="alert alert-error">{loadError}</p>
        <Link href="/manager/login">تسجيل الدخول</Link>
      </div>
    );
  }

  if (!data) {
    return <p className="muted">جاري تحميل لوحة المدير...</p>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
        <div>
          <h1 className="page-title">لوحة المدير</h1>
          <p className="page-subtitle">أنشئ مهمة وشارك الرابط — اضغط «عرض التفاصيل» لمتابعة كل زائر</p>
        </div>
        <Link className="btn btn-primary" href="/manager/tasks/new">
          + مهمة جديدة
        </Link>
      </div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">الزوار المسجلون (كل المهام)</div>
          <div className="stat-value">{data.summary.visitors}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">إجمالي المهام</div>
          <div className="stat-value">{data.summary.total_tasks}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">جلسات مكتملة</div>
          <div className="stat-value">{data.summary.completed}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">جلسات جزئية</div>
          <div className="stat-value">{data.summary.partial}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">قيد التنفيذ</div>
          <div className="stat-value">{data.summary.in_progress}</div>
        </div>
      </div>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>المهام</h2>
        {data.recent_tasks.length === 0 ? (
          <div className="empty-state">لم تنشئ أي مهمة بعد.</div>
        ) : (
          data.recent_tasks.map((task) => (
            <article
              key={task.id}
              style={{
                marginBottom: 20,
                paddingBottom: 20,
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <Link
                    href={task.report_url}
                    style={{ fontSize: 18, fontWeight: 700, textDecoration: "none" }}
                  >
                    {task.title}
                  </Link>
                  <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                    {task.target_url}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <span className="badge badge-info">{task.visitor_count} متصفح</span>
                    <span className="badge badge-muted">{task.unique_ip_count} IP</span>
                    {task.possible_shared_network && (
                      <span className="badge badge-info">شبكة مشتركة</span>
                    )}
                    <span className="badge badge-muted">{task.session_count} جلسة</span>
                    {task.in_progress_count > 0 && (
                      <span className="badge badge-warning">{task.in_progress_count} جاري الآن</span>
                    )}
                    {task.completed_visitor_count > 0 && (
                      <span className="badge badge-success">{task.completed_visitor_count} أنجز</span>
                    )}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                    أُنشئت {formatDate(task.created_at)}
                  </div>
                </div>
                <Link className="btn btn-primary" href={task.report_url}>
                  عرض التفاصيل والزوار
                </Link>
              </div>
              <input className="input" readOnly value={task.public_url} style={{ fontSize: 13 }} />
            </article>
          ))
        )}
      </section>
    </div>
  );
}
