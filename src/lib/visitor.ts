import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { nanoid } from "nanoid";
import { getClientIp, hashIp } from "@/lib/tracking";
import { buildVisitorDisplayName } from "@/lib/visitor-report";
import { parseUserAgent } from "@/lib/user-agent";

export const VISITOR_COOKIE = "tt_visitor";
const VISITOR_DAYS = 365;

export type VisitorInfo = {
  id: string;
  label: string;
  key: string;
};

function generateVisitorLabel(
  ipAddress: string,
  ipHash: string,
  userAgent?: string,
  visitorId?: string
): string {
  const parsed = parseUserAgent(userAgent);
  const label = buildVisitorDisplayName(
    ipAddress,
    ipHash,
    parsed.browser,
    parsed.os,
    parsed.device,
    visitorId
  );
  if (label !== "زائر — غير معروف") return label;
  return `ز-${nanoid(4)}`;
}

export async function getVisitorKeyFromCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(VISITOR_COOKIE)?.value ?? null;
}

export async function setVisitorCookie(key: string): Promise<void> {
  const jar = await cookies();
  jar.set(VISITOR_COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VISITOR_DAYS * 24 * 60 * 60,
  });
}

export async function getOrCreateVisitor(request: Request): Promise<VisitorInfo> {
  const jar = await cookies();
  const existingKey = jar.get(VISITOR_COOKIE)?.value;
  const ipAddress = getClientIp(request);
  const ipHash = hashIp(ipAddress);
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const now = new Date();

  if (existingKey) {
    const visitor = await prisma.visitor.findUnique({ where: { visitorKey: existingKey } });
    if (visitor) {
      const label = generateVisitorLabel(ipAddress, ipHash, userAgent, visitor.id);
      const shouldRefreshLabel =
        visitor.label.startsWith("ز-") ||
        !visitor.ipAddress ||
        !visitor.label.includes("#");

      await prisma.visitor.update({
        where: { id: visitor.id },
        data: {
          lastSeenAt: now,
          userAgent,
          ipAddress,
          ipHash,
          label: shouldRefreshLabel ? label : visitor.label,
        },
      });
      return {
        id: visitor.id,
        label: shouldRefreshLabel ? label : visitor.label,
        key: visitor.visitorKey,
      };
    }
  }

  const key = nanoid(32);

  const visitor = await prisma.visitor.create({
    data: {
      visitorKey: key,
      label: `ز-${nanoid(4)}`,
      ipAddress,
      ipHash,
      userAgent,
    },
  });

  const label = generateVisitorLabel(ipAddress, ipHash, userAgent, visitor.id);
  if (label !== visitor.label) {
    await prisma.visitor.update({
      where: { id: visitor.id },
      data: { label },
    });
  }

  await setVisitorCookie(key);

  return { id: visitor.id, label, key: visitor.visitorKey };
}
