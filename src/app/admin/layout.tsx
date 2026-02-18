import { LogoutButton } from "@/app/logout-button";
import { AdminTopNav } from "./admin-top-nav";
import { requireRole } from "@/lib/access";
import Image from "next/image";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireRole("ADMIN");
  const displayName = session.user.email?.split("@")[0] || "Benutzer";

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-topbar-inner">
          <Link href="/admin" className="admin-brand" aria-label="Peakly Admin">
            <Image
              src="/logo_small_01.png"
              alt="Peakly Logo"
              width={24}
              height={24}
              className="admin-brand-logo"
              priority
            />
            <span>Peakly</span>
          </Link>

          <AdminTopNav />

          <div className="admin-topbar-actions">
            <Link href="/admin/users" className="admin-user-button">
              {displayName}
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="admin-main">{children}</main>
    </div>
  );
}
