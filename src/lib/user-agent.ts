export type ParsedUserAgent = {
  browser: string | null;
  os: string | null;
  device: string | null;
};

export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  if (!userAgent) {
    return { browser: null, os: null, device: null };
  }

  let device = "كمبيوتر";
  if (/Mobile|Android|iPhone|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
    device = /iPad|Tablet|SM-T/i.test(userAgent) ? "جهاز لوحي" : "جوال";
  }

  let browser: string | null = null;
  if (/Edg\//i.test(userAgent)) browser = "Microsoft Edge";
  else if (/OPR\//i.test(userAgent) || /Opera/i.test(userAgent)) browser = "Opera";
  else if (/Chrome\//i.test(userAgent) && !/Edg/i.test(userAgent)) browser = "Chrome";
  else if (/Firefox\//i.test(userAgent)) browser = "Firefox";
  else if (/Safari\//i.test(userAgent) && !/Chrome/i.test(userAgent)) browser = "Safari";
  else browser = "غير معروف";

  let os: string | null = null;
  if (/Windows NT 10/i.test(userAgent)) os = "Windows 10/11";
  else if (/Windows NT 6.3/i.test(userAgent)) os = "Windows 8.1";
  else if (/Windows/i.test(userAgent)) os = "Windows";
  else if (/Mac OS X/i.test(userAgent)) os = "macOS";
  else if (/Android/i.test(userAgent)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(userAgent)) os = "iOS";
  else if (/Linux/i.test(userAgent)) os = "Linux";
  else os = "غير معروف";

  return { browser, os, device };
}
