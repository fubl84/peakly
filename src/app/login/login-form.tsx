"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

const initialState: string | null = null;

export function LoginForm() {
  const [error, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <form action={formAction} className="form-grid">
      <label className="field">
        E-Mail
        <input name="email" type="email" required />
      </label>

      <label className="field">
        Passwort
        <input name="password" type="password" required />
      </label>

      <button type="submit" disabled={pending}>
        {pending ? "Anmeldung läuft..." : "Anmelden"}
      </button>

      {error ? <p className="error-text">{error}</p> : null}
    </form>
  );
}
