"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function NewTaskPage() {
  const [form, setForm] = useState({
    title: "",
    target_url: "",
    required_duration_minutes: 30,
  });
  const [createdTask, setCreatedTask] = useState<{ id: string; public_url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCreatedTask(null);

    const res = await fetch("/api/manager/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        required_duration_seconds: form.required_duration_minutes * 60,
      }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "تعذر إنشاء المهمة");
      return;
    }

    setCreatedTask({ id: data.task.id, public_url: data.task.public_url });
  }

  async function copyLink() {
    if (!createdTask?.public_url) return;
    await navigator.clipboard.writeText(createdTask.public_url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <Link className="muted" href="/manager">
        ← العودة للوحة
      </Link>
      <h1 className="page-title" style={{ marginTop: 16 }}>
        مهمة جديدة
      </h1>
      <p className="page-subtitle">
        بعد الإنشاء، شارك الرابط مع أي شخص — يُسجَّل تلقائياً عبر الكوكيز بدون تسجيل حساب
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      {createdTask && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <strong>تم إنشاء المهمة.</strong> شارك هذا الرابط:
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <input className="input" readOnly value={createdTask.public_url} style={{ flex: 1, minWidth: 220 }} />
            <button className="btn btn-secondary" type="button" onClick={copyLink}>
              {copied ? "تم النسخ" : "نسخ الرابط"}
            </button>
            <Link className="btn btn-primary" href={`/t/${createdTask.id}`}>
              تجربة الرابط
            </Link>
            <Link className="btn btn-secondary" href={`/manager/tasks/${createdTask.id}`}>
              عرض التفاصيل والزوار
            </Link>
          </div>
        </div>
      )}

      <form className="card" onSubmit={onSubmit}>
        <div className="field">
          <label className="label">عنوان المهمة</label>
          <input
            className="input"
            placeholder="مثال: اقرأ خبر السياحة في ماليزيا"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>

        <div className="field">
          <label className="label">رابط الصفحة</label>
          <input
            className="input"
            placeholder="https://your-site.com/news/malaysia"
            value={form.target_url}
            onChange={(e) => setForm({ ...form, target_url: e.target.value })}
            required
          />
        </div>

        <div className="field">
          <label className="label">المدة المطلوبة (بالدقائق)</label>
          <input
            className="input"
            type="number"
            min={1}
            value={form.required_duration_minutes}
            onChange={(e) =>
              setForm({ ...form, required_duration_minutes: Number(e.target.value) })
            }
          />
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            مثال: 30 دقيقة — إذا بقي الزائر 10 دقائق فقط، تُسجَّل كمهمة جزئية مع تفاصيل تفاعله.
          </p>
        </div>

        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "جاري الإنشاء..." : "إنشاء المهمة والحصول على الرابط"}
        </button>
      </form>
    </div>
  );
}
