"use server";

import { auth } from "@/auth";

type SessionLike = {
  user?: {
    id?: string;
    email?: string | null;
    role?: string;
  };
} | null;

function isAdminActionAllowed(session: SessionLike) {
  return Boolean(session?.user && session.user.role === "ADMIN");
}

export async function assertAdminAction(args?: { session?: SessionLike }) {
  const session =
    args && "session" in args
      ? (args.session ?? null)
      : ((await auth()) as SessionLike);

  if (!isAdminActionAllowed(session)) {
    throw new Error("Keine Berechtigung");
  }

  return session;
}
