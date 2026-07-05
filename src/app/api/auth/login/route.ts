import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/db";
import { createSession, setSessionCookie, unauthorizedResponse } from "@/lib/session";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return Response.json({ error: "البريد وكلمة المرور مطلوبان" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    return unauthorizedResponse();
  }

  if (user.role !== "manager") {
    return Response.json({ error: "هذا الدخول للمدير فقط" }, { status: 403 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return unauthorizedResponse();
  }

  const token = await createSession(user.id);
  await setSessionCookie(token);

  return Response.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      employeeCode: user.employeeCode,
    },
  });
}
