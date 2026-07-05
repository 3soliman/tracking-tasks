"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DurationTracker } from "@/components/DurationTracker";

function TargetPageTrackerInner() {
  const params = useSearchParams();
  const sessionToken = params.get("_tsk");
  const [requiredSeconds, setRequiredSeconds] = useState(30);

  useEffect(() => {
    if (!sessionToken) return;
    fetch(`/api/track/session/${sessionToken}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.required_duration_seconds) {
          setRequiredSeconds(data.required_duration_seconds);
        }
      })
      .catch(() => {});
  }, [sessionToken]);

  if (!sessionToken) return null;

  return <DurationTracker sessionToken={sessionToken} requiredDurationSeconds={requiredSeconds} />;
}

export function TargetPageTracker() {
  return (
    <Suspense fallback={null}>
      <TargetPageTrackerInner />
    </Suspense>
  );
}
