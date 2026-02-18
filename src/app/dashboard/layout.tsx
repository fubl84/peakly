import { LogoutButton } from "@/app/logout-button";
import { requireAuth } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";

const PRIMARY_NAV_LINKS = [
  { href: "/dashboard", label: "Übersicht" },
  {
    label: "Training",
    children: [
      { href: "/dashboard/planner/training", label: "Plan" },
      { href: "/dashboard/workout", label: "Live Workout" },
      { href: "/dashboard/exercises", label: "Übungsbibliothek" },
    ],
  },
  {
    label: "Ernährung",
    children: [
      { href: "/dashboard/planner/nutrition", label: "Plan" },
      { href: "/dashboard/planner/nutrition/recipes", label: "Rezepte" },
    ],
  },
  { href: "/dashboard/shopping-list", label: "Einkaufsliste" },
  { href: "/dashboard/paths", label: "Pfade" },
] as const;

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireAuth();
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { displayName: true },
  });
  const displayName =
    user?.displayName?.trim() || session.user.email?.split("@")[0] || "Profil";

  return (
    <div className="user-shell">
      <header className="user-topbar">
        <div className="user-topbar-inner">
          <div className="user-brand-row">
            <Link href="/dashboard" className="user-brand">
              <Image
                src="/logo_small_01.png"
                alt="Peakly Logo"
                width={28}
                height={28}
                className="user-brand-logo"
                priority
              />
              Peakly
            </Link>

            <div className="user-meta">
              <Link href="/dashboard/settings" className="user-meta-link">
                {displayName}
              </Link>
              <LogoutButton />
            </div>
          </div>

          <nav className="user-nav-desktop" aria-label="Dashboard Navigation">
            <div className="user-nav-links">
              {PRIMARY_NAV_LINKS.map((item) =>
                "href" in item ? (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="user-nav-link"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <div key={item.label} className="user-nav-group">
                    <span className="user-nav-group-label">{item.label}</span>
                    <div className="user-nav-sub-links">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="user-nav-link is-sub"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          </nav>

          <details className="user-menu-mobile">
            <summary>Menü</summary>
            <nav
              className="user-menu-grid"
              aria-label="Mobile Dashboard Navigation"
            >
              {PRIMARY_NAV_LINKS.map((item) =>
                "href" in item ? (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="user-nav-link"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <div key={item.label} className="user-nav-group">
                    <span className="user-nav-group-label">{item.label}</span>
                    <div className="user-nav-sub-links">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="user-nav-link is-sub"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ),
              )}
            </nav>
          </details>
        </div>
      </header>

      <div className="user-main">{children}</div>
    </div>
  );
}
