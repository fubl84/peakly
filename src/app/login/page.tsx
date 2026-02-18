import { auth } from "@/auth";
import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-wrap auth-page">
      <section className="auth-card stack">
        <div
          style={{
            display: "grid",
            justifyItems: "center",
            gap: "0.65rem",
          }}
        >
          <Image
            src="/logo_medium.png"
            alt="Peakly Logo"
            width={120}
            height={120}
            priority
          />
          <h1 className="page-title" style={{ margin: 0 }}>
            Willkommen bei Peakly
          </h1>
        </div>
        <p className="muted">
          Bitte mit den bereitgestellten Zugangsdaten anmelden.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
