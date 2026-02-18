import { auth } from "@/auth";
import { UserRole } from "@/types/auth";
import { redirect } from "next/navigation";

type SessionLike = {
  user?: {
    id?: string;
    email?: string | null;
    role?: UserRole;
  };
} | null;

type AuthenticatedSession = {
  user: {
    id: string;
    email: string | null;
    role: UserRole;
  };
};

type AccessOverrides = {
  session?: SessionLike;
  redirectFn?: (path: string) => void;
};

export async function requireAuth(overrides?: AccessOverrides) {
  const session =
    overrides && "session" in overrides
      ? (overrides.session as SessionLike)
      : ((await auth()) as SessionLike);
  const redirectFn = overrides?.redirectFn ?? redirect;

  if (!session?.user?.id) {
    redirectFn("/login");
    throw new Error("Nicht angemeldet");
  }

  const user = session.user as {
    id: string;
    email?: string | null;
    role?: UserRole;
  };

  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      role: user.role ?? "USER",
    },
  } satisfies AuthenticatedSession;
}

export async function requireRole(
  requiredRole: UserRole,
  overrides?: AccessOverrides,
) {
  const session = await requireAuth(overrides);
  const redirectFn = overrides?.redirectFn ?? redirect;

  if (!session?.user || session.user.role !== requiredRole) {
    redirectFn("/dashboard");
  }

  return session;
}
