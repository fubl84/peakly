import { auth } from "@/auth";
import Image from "next/image";
import Link from "next/link";
import { LogoutButton } from "./logout-button";

export default async function Home() {
  const session = await auth();

  return (
    <main className="auth-wrap landing-page">
      <section className="auth-card stack">
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.55rem",
          }}
        >
          <Image
            src="/logo_small_01.png"
            alt="Peakly Logo"
            width={34}
            height={34}
          />
          <h1 className="page-title" style={{ margin: 0 }}>
            Peakly
          </h1>
        </div>
        <p className="muted">
          Dein geschlossenes Fitness-System für Pfade, Wochenplanung, Shopping
          und Live-Workout.
        </p>

        {session?.user ? (
          <>
            <p className="muted">
              Angemeldet als <strong>{session.user.email}</strong> (
              {session.user.role})
            </p>
            <div className="user-nav-links">
              <Link href="/dashboard" className="user-nav-link">
                Zum Dashboard
              </Link>
              {session.user.role === "ADMIN" ? (
                <Link href="/admin" className="user-nav-link">
                  Zum Admin-Bereich
                </Link>
              ) : null}
              <LogoutButton />
            </div>
          </>
        ) : (
          <Link href="/login" className="user-nav-link">
            Zum Login
          </Link>
        )}
      </section>
      <section className="card stack" style={{ maxWidth: 460 }}>
        <h2 className="section-title">Was dich hier erwartet</h2>
        <ul style={{ paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
          <li>Wöchentliche Trainings- und Ernährungsplanung</li>
          <li>Shopping-Liste inkl. Pair-Modus</li>
          <li>Live-Workout mit Timer und Schrittführung</li>
          <li>AI-Unterstützung für Motivation und Meal-Anpassung</li>
        </ul>
      </section>
    </main>
  );
}
