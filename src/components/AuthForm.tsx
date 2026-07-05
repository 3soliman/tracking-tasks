"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  title: string;
  subtitle?: string;
  submitLabel: string;
  endpoint: "/api/auth/login";
  fields: Array<{ name: string; label: string; type?: string; placeholder?: string }>;
  redirectTo: string;
  footer?: React.ReactNode;
};

export function AuthForm({
  title,
  subtitle,
  submitLabel,
  endpoint,
  fields,
  redirectTo,
  footer,
}: Props) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "حدث خطأ");
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={onSubmit}>
          {fields.map((field) => (
            <div className="field" key={field.name}>
              <label className="label" htmlFor={field.name}>
                {field.label}
              </label>
              <input
                id={field.name}
                className="input"
                type={field.type ?? "text"}
                placeholder={field.placeholder}
                value={values[field.name] ?? ""}
                onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                required
              />
            </div>
          ))}

          <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
            {loading ? "جاري التحميل..." : submitLabel}
          </button>
        </form>

        {footer && <div style={{ marginTop: 20 }}>{footer}</div>}
      </div>
    </div>
  );
}
