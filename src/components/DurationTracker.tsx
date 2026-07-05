"use client";

import { useEffect, useRef } from "react";

type Props = {
  sessionToken: string;
  requiredDurationSeconds: number;
};

export function DurationTracker({ sessionToken, requiredDurationSeconds }: Props) {
  const activeMs = useRef(0);
  const lastTick = useRef<number | null>(null);
  const sent = useRef(false);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") {
        const now = performance.now();
        if (lastTick.current !== null) {
          activeMs.current += now - lastTick.current;
        }
        lastTick.current = now;
      } else {
        lastTick.current = null;
      }
    };

    const interval = window.setInterval(tick, 1000);
    tick();

    const sendCompletion = () => {
      if (sent.current) return;
      sent.current = true;
      const durationSeconds = Math.floor(activeMs.current / 1000);
      const payload = JSON.stringify({
        session_token: sessionToken,
        duration_seconds: durationSeconds,
      });
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/track/complete", blob);
    };

    const onVisibility = () => tick();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", sendCompletion);
    window.addEventListener("beforeunload", sendCompletion);

    const completionTimer = window.setTimeout(() => {
      if (Math.floor(activeMs.current / 1000) >= requiredDurationSeconds) {
        sendCompletion();
      }
    }, (requiredDurationSeconds + 2) * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(completionTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", sendCompletion);
      window.removeEventListener("beforeunload", sendCompletion);
      sendCompletion();
    };
  }, [sessionToken, requiredDurationSeconds]);

  return null;
}
