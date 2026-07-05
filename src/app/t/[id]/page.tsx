"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function PublicTaskEntryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    fetch(`/api/public/tasks/${params.id}/start`, { method: "POST" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "تعذر بدء المهمة");
        return body;
      })
      .then((body) => router.replace(body.work_url))
      .catch((err: Error) => setError(err.message));
  }, [params.id, router]);

  if (error) {
    return (
      <main className="container hero">
        <div className="card">
          <h1 className="page-title">تعذر فتح المهمة</h1>
          <p>{error}</p>
          <Link href="/">العودة للرئيسية</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="container hero">
      <p className="muted">جاري فتح المهمة وتسجيل زيارتك...</p>
    </main>
  );
}
