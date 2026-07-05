export const GA4_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID ?? "";

export function ga4ScriptSnippet(): string {
  if (!GA4_MEASUREMENT_ID) return "";
  return `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${GA4_MEASUREMENT_ID}');
  `;
}

export type TaskClickEvent = {
  task_id: string;
  employee_id: string;
  employee_code: string;
  campaign_name?: string | null;
  page_url: string;
  click_id: string;
};

export function buildTaskClickEventPayload(event: TaskClickEvent) {
  return {
    event: "task_click",
    ...event,
  };
}
