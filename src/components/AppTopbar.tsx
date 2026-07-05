"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  name: string;
  roleLabel: string;
  homeHref: string;
};

export function AppTopbar({ name, roleLabel, homeHref }: Props) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <div>
          <strong>{roleLabel}</strong>
          <div className="muted" style={{ fontSize: 14 }}>
            مرحباً، {name}
          </div>
        </div>
        <nav className="nav-links">
          <Link href={homeHref}>الرئيسية</Link>
          <button className="btn btn-secondary" type="button" onClick={logout}>
            تسجيل الخروج
          </button>
        </nav>
      </div>
    </header>
  );
}
