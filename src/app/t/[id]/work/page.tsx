"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { TaskWorkSession } from "@/components/TaskWorkSession";

function WorkPageInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const taskId = params.id;
  const session = searchParams.get("session");
  const [visitor, setVisitor] = useState<{ id: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (session) {
      fetch(`/api/public/tasks/${taskId}/start`, { method: "POST" })
        .then(async (res) => {
          const body = await res.json().catch(() => ({}));
          if (res.ok && body.visitor) {
            setVisitor(body.visitor);
          }
        })
        .catch(() => {});
      return;
    }

    if (startedRef.current) return;
    startedRef.current = true;

    fetch(`/api/public/tasks/${taskId}/start`, { method: "POST" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? "تعذر بدء المهمة");
        return body;
      })
      .then((body) => {
        setVisitor(body.visitor);
        router.replace(body.work_url);
      })
      .catch((err: Error) => setError(err.message));
  }, [taskId, session, router]);

  if (error) {
    return (
      <div className="container" style={{ paddingTop: 48 }}>
        <div className="card">
          <h1 className="page-title">تعذر بدء المهمة</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!session || !visitor) {
    return (
      <div className="container" style={{ paddingTop: 48 }}>
        <p className="muted">جاري تجهيز جلسة العمل...</p>
      </div>
    );
  }

  return <TaskWorkSession sessionToken={session} visitor={visitor} taskId={taskId} />;
}

export default function PublicWorkPage() {
  return (
    <Suspense fallback={<p className="muted">جاري التحميل...</p>}>
      <WorkPageInner />
    </Suspense>
  );
}
