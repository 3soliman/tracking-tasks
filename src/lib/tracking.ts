import { createHash } from "crypto";
import { nanoid } from "nanoid";

export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? "tracking-tasks-default-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export function generateSessionToken(): string {
  return nanoid(24);
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function appendSessionToUrl(targetUrl: string, sessionToken: string): string {
  try {
    const url = new URL(targetUrl);
    url.searchParams.set("_tsk", sessionToken);
    return url.toString();
  } catch {
    const separator = targetUrl.includes("?") ? "&" : "?";
    return `${targetUrl}${separator}_tsk=${sessionToken}`;
  }
}

export function isRapidDuplicate(
  lastClickAt: Date | null,
  thresholdSeconds = 10
): boolean {
  if (!lastClickAt) return false;
  const elapsed = Date.now() - lastClickAt.getTime();
  return elapsed < thresholdSeconds * 1000;
}
