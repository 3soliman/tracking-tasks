import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function ManagerLoginPage() {
  return (
    <AuthForm
      title="دخول المدير"
      subtitle="لوحة متابعة المهام والزوار"
      submitLabel="دخول"
      endpoint="/api/auth/login"
      redirectTo="/manager"
      fields={[
        { name: "email", label: "البريد الإلكتروني", type: "email", placeholder: "admin@company.com" },
        { name: "password", label: "كلمة المرور", type: "password", placeholder: "******" },
      ]}
      footer={
        <p className="muted">
          <Link href="/">العودة للصفحة الرئيسية</Link>
        </p>
      }
    />
  );
}
