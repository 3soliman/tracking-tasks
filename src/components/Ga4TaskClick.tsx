"use client";

import { useEffect, useRef } from "react";
import { GA4_MEASUREMENT_ID } from "@/lib/ga4";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

type Props = {
  clickId: string;
  taskId: string;
  visitorId: string;
  visitorLabel: string;
  campaignName?: string | null;
  pageUrl: string;
};

export function Ga4TaskClick({
  clickId,
  taskId,
  visitorId,
  visitorLabel,
  campaignName,
  pageUrl,
}: Props) {
  const sent = useRef(false);

  useEffect(() => {
    if (!GA4_MEASUREMENT_ID || sent.current) return;
    sent.current = true;

    const send = () => {
      if (typeof window.gtag === "function") {
        window.gtag("event", "task_click", {
          task_id: taskId,
          visitor_id: visitorId,
          visitor_label: visitorLabel,
          campaign_name: campaignName ?? undefined,
          page_url: pageUrl,
          click_id: clickId,
        });
      }

      fetch("/api/track/ga4-sent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ click_id: clickId }),
        keepalive: true,
      }).catch(() => {});
    };

    if (typeof window.gtag === "function") {
      send();
      return;
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA4_MEASUREMENT_ID);

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
    script.onload = send;
    document.head.appendChild(script);
  }, [clickId, taskId, visitorId, visitorLabel, campaignName, pageUrl]);

  return null;
}
