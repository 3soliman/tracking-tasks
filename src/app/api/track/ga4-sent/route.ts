import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  let body: { click_id?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.click_id) {
    return Response.json({ error: "click_id is required" }, { status: 400 });
  }

  await prisma.trackingClick.update({
    where: { id: body.click_id },
    data: { ga4Sent: true },
  });

  return Response.json({ ok: true });
}
