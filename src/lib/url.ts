export function isExternalUrl(targetUrl: string, appOrigin?: string): boolean {
  try {
    const target = new URL(targetUrl);
    const origin = appOrigin ?? (typeof window !== "undefined" ? window.location.origin : "");
    if (!origin) return true;
    return target.origin !== origin;
  } catch {
    return true;
  }
}

export function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProtocol).href;
  } catch {
    return null;
  }
}

/** True when page URL matches the assigned task target (same host, similar path). */
export function isOnTaskTarget(pageUrl: string, taskTargetUrl: string): boolean {
  if (!pageUrl || !taskTargetUrl) return false;
  try {
    const page = new URL(pageUrl);
    const task = new URL(taskTargetUrl);
    if (page.origin !== task.origin) return false;
    const pagePath = page.pathname.replace(/\/$/, "");
    const taskPath = task.pathname.replace(/\/$/, "");
    return pagePath === taskPath || pagePath.startsWith(taskPath) || taskPath.startsWith(pagePath);
  } catch {
    return pageUrl.startsWith(taskTargetUrl) || taskTargetUrl.startsWith(pageUrl);
  }
}
