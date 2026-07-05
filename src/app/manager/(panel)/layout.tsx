import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { AppTopbar } from "@/components/AppTopbar";

export default async function ManagerPanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/manager/login");
  if (user.role !== "manager") redirect("/");

  return (
    <div>
      <AppTopbar name={user.name} roleLabel="لوحة المدير" homeHref="/manager" />
      <div className="container" style={{ paddingBottom: 48 }}>
        {children}
      </div>
    </div>
  );
}
