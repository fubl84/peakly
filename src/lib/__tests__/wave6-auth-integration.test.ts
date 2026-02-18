import { assertAdminAction } from "@/lib/admin-action";
import { evaluateAdminApiAccess, requireAdminApi } from "@/lib/api-access";
import { requireAuth, requireRole } from "@/lib/access";

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected '${expected}', got '${actual}'`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

type SessionLike = {
  user?: {
    id?: string;
    email?: string | null;
    role?: "ADMIN" | "USER";
  };
} | null;

async function readJson(response: Response) {
  return (await response.json()) as { error?: string };
}

async function testAdminApiBoundary() {
  const unauth = evaluateAdminApiAccess(null);
  assert(unauth !== null, "Unauthenticated API access should be rejected");
  assertEqual(unauth?.status, 401, "Unauthenticated API status should be 401");

  const unauthBody = await readJson(unauth as Response);
  assertEqual(
    unauthBody.error,
    "Nicht angemeldet",
    "Unauthenticated API error should be localized",
  );

  const userOnly = evaluateAdminApiAccess({
    user: { id: "u1", email: "user@test.local", role: "USER" },
  });
  assert(userOnly !== null, "Non-admin API access should be rejected");
  assertEqual(userOnly?.status, 403, "Non-admin API status should be 403");

  const userBody = await readJson(userOnly as Response);
  assertEqual(
    userBody.error,
    "Keine Berechtigung",
    "Non-admin API error should be localized",
  );

  const adminAllowed = evaluateAdminApiAccess({
    user: { id: "a1", email: "admin@test.local", role: "ADMIN" },
  });
  assertEqual(adminAllowed, null, "Admin API access should be allowed");

  const viaRequire = await requireAdminApi({
    session: {
      user: { id: "a1", email: "admin@test.local", role: "ADMIN" },
    },
  });
  assertEqual(
    viaRequire,
    null,
    "requireAdminApi should allow injected admin session",
  );
}

async function testAdminActionBoundary() {
  let blocked = false;
  try {
    await assertAdminAction({
      session: {
        user: { id: "u1", email: "user@test.local", role: "USER" },
      },
    });
  } catch (error) {
    blocked = true;
    const message = error instanceof Error ? error.message : "";
    assertEqual(
      message,
      "Keine Berechtigung",
      "Admin action should reject non-admin with clear error",
    );
  }

  assert(blocked, "Admin action should throw for non-admin");

  const allowed = (await assertAdminAction({
    session: {
      user: { id: "a1", email: "admin@test.local", role: "ADMIN" },
    },
  })) as SessionLike;

  assertEqual(allowed?.user?.role, "ADMIN", "Admin action should allow admins");
}

async function testPageRoleBoundary() {
  let redirectedTo: string | null = null;
  const redirectFn = (path: string) => {
    redirectedTo = path;
  };

  const authenticated = await requireAuth({
    session: {
      user: { id: "u1", email: "user@test.local", role: "USER" },
    },
    redirectFn,
  });

  assertEqual(
    authenticated.user.id,
    "u1",
    "requireAuth should return authenticated user",
  );
  assertEqual(
    redirectedTo,
    null,
    "Authenticated user should not trigger redirect",
  );

  redirectedTo = null;
  await requireRole("ADMIN", {
    session: {
      user: { id: "u1", email: "user@test.local", role: "USER" },
    },
    redirectFn,
  });
  assertEqual(
    redirectedTo,
    "/dashboard",
    "requireRole should redirect user lacking required role",
  );

  redirectedTo = null;
  let unauthThrown = false;
  try {
    await requireAuth({ session: null, redirectFn });
  } catch (error) {
    unauthThrown = true;
    const message = error instanceof Error ? error.message : "";
    assertEqual(
      message,
      "Nicht angemeldet",
      "requireAuth should throw after login redirect",
    );
  }

  assert(unauthThrown, "requireAuth should throw for unauthenticated session");
  assertEqual(
    redirectedTo,
    "/login",
    "requireAuth should redirect unauthenticated users to /login",
  );
}

async function main() {
  await testAdminApiBoundary();
  await testAdminActionBoundary();
  await testPageRoleBoundary();
  console.log("Wave 6 F-02 integration tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
