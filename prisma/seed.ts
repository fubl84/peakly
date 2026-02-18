import { PrismaClient, RoleName } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = "admin@flamingbattenberg.de";
const DEFAULT_ADMIN_PASSWORD = "Password123!";
const DEFAULT_ADMIN_DISPLAY_NAME = "Admin";

function getEnvValue(name: string): string | null {
  const value = process.env[name];

  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function ensureRole(roleName: RoleName) {
  return prisma.role.upsert({
    where: { name: roleName },
    update: {},
    create: { name: roleName },
  });
}

async function ensureUserWithRole(args: {
  email: string;
  roleName: RoleName;
  displayName: string;
  passwordHash: string;
}) {
  const user = await prisma.user.upsert({
    where: { email: args.email },
    update: {
      displayName: args.displayName,
      passwordHash: args.passwordHash,
    },
    create: {
      email: args.email,
      displayName: args.displayName,
      passwordHash: args.passwordHash,
    },
  });

  const role = await ensureRole(args.roleName);

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id,
    },
  });
}

async function main() {
  const adminEmail = (
    getEnvValue("INITIAL_ADMIN_EMAIL") ?? DEFAULT_ADMIN_EMAIL
  ).toLowerCase();
  const adminPassword =
    getEnvValue("INITIAL_ADMIN_PASSWORD") ?? DEFAULT_ADMIN_PASSWORD;
  const adminDisplayName =
    getEnvValue("INITIAL_ADMIN_DISPLAY_NAME") ?? DEFAULT_ADMIN_DISPLAY_NAME;

  if (adminPassword.length < 12) {
    throw new Error(
      "INITIAL_ADMIN_PASSWORD must be at least 12 characters long.",
    );
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await ensureRole(RoleName.USER);
  await ensureUserWithRole({
    email: adminEmail,
    roleName: RoleName.ADMIN,
    displayName: adminDisplayName,
    passwordHash,
  });

  console.log(`Seed finished: admin account ensured for ${adminEmail}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
