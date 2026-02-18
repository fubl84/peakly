import { PrismaClient, RoleName } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function requireEnv(name) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

async function main() {
  const adminEmail = requireEnv("INITIAL_ADMIN_EMAIL").toLowerCase();
  const adminPassword = requireEnv("INITIAL_ADMIN_PASSWORD");
  const adminDisplayName = process.env.INITIAL_ADMIN_DISPLAY_NAME?.trim() || "Admin";

  if (adminPassword.length < 12) {
    throw new Error("INITIAL_ADMIN_PASSWORD must be at least 12 characters long.");
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const role = await prisma.role.upsert({
    where: { name: RoleName.ADMIN },
    update: {},
    create: { name: RoleName.ADMIN },
  });

  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      displayName: adminDisplayName,
      passwordHash,
    },
    create: {
      email: adminEmail,
      displayName: adminDisplayName,
      passwordHash,
    },
  });

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

  console.log(`Initial admin ensured for ${adminEmail}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
