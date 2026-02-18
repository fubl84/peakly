"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function loginAction(_: string | null, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return "Anmeldung fehlgeschlagen. Bitte Zugangsdaten prüfen.";
    }

    throw error;
  }

  return null;
}
