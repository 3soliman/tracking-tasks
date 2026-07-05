import { getCurrentUser, unauthorizedResponse } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorizedResponse();
  return Response.json({ user });
}
