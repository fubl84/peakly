import { auth } from "@/auth";
import { NextResponse } from "next/server";

type SessionLike = {
  user?: {
    id?: string;
    email?: string | null;
    role?: string;
  };
} | null;

export function evaluateAdminApiAccess(session: SessionLike) {
  if (!session?.user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  return null;
}

export async function requireAdminApi(args?: { session?: SessionLike }) {
  const session =
    args && "session" in args
      ? (args.session ?? null)
      : ((await auth()) as SessionLike);

  return evaluateAdminApiAccess(session);
}
