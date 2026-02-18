"use client";

import Link from "next/link";
import { useState } from "react";

const CONTENT_LINKS = [
  { href: "/admin/variants", label: "Varianten" },
  { href: "/admin/exercises", label: "Übungen" },
  { href: "/admin/ingredients", label: "Zutaten" },
] as const;

const PLAN_LINKS = [
  { href: "/admin/training-plans", label: "Trainingspläne" },
  { href: "/admin/nutrition-plans", label: "Ernährungspläne" },
] as const;

type OpenGroup = "content" | "plans" | null;

export function AdminTopNav() {
  const [openGroup, setOpenGroup] = useState<OpenGroup>(null);

  const toggleGroup = (group: Exclude<OpenGroup, null>) => {
    setOpenGroup((prev) => (prev === group ? null : group));
  };

  const closeGroup = () => {
    setOpenGroup(null);
  };

  return (
    <nav className="admin-nav" aria-label="Admin Navigation">
      <Link href="/admin" className="admin-nav-link" onClick={closeGroup}>
        Übersicht
      </Link>

      <div className="admin-nav-group">
        <button
          type="button"
          className="admin-nav-group-toggle"
          onClick={() => toggleGroup("content")}
          aria-expanded={openGroup === "content"}
        >
          Content
        </button>
        {openGroup === "content" ? (
          <div className="admin-nav-group-menu">
            {CONTENT_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="admin-nav-link is-sub"
                onClick={closeGroup}
              >
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <div className="admin-nav-group">
        <button
          type="button"
          className="admin-nav-group-toggle"
          onClick={() => toggleGroup("plans")}
          aria-expanded={openGroup === "plans"}
        >
          Pläne
        </button>
        {openGroup === "plans" ? (
          <div className="admin-nav-group-menu">
            {PLAN_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="admin-nav-link is-sub"
                onClick={closeGroup}
              >
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <Link href="/admin/recipes" className="admin-nav-link" onClick={closeGroup}>
        Rezepte
      </Link>
      <Link href="/admin/info-blocks" className="admin-nav-link" onClick={closeGroup}>
        Info-Blöcke
      </Link>
      <Link href="/admin/paths" className="admin-nav-link" onClick={closeGroup}>
        Pfade
      </Link>
      <Link href="/admin/users" className="admin-nav-link" onClick={closeGroup}>
        Benutzer
      </Link>
    </nav>
  );
}
