"use server";

import { assertAdminAction } from "@/lib/admin-action";
import { getOptionalString, getRequiredString } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function assertPasswordStrength(password: string) {
  if (password.length < 8) {
    throw new Error("Passwort muss mindestens 8 Zeichen lang sein.");
  }
}

export async function createAdminUser(formData: FormData) {
  await assertAdminAction();

  const email = normalizeEmail(getRequiredString(formData, "email"));
  const displayName = getRequiredString(formData, "displayName");
  const password = getRequiredString(formData, "password");

  assertPasswordStrength(password);
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email,
      displayName,
      passwordHash,
      userRoles: {
        create: {
          role: {
            connectOrCreate: {
              where: { name: "USER" },
              create: { name: "USER" },
            },
          },
        },
      },
    },
  });

  revalidatePath("/admin/users");
}

export async function updateAdminUser(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");
  const email = normalizeEmail(getRequiredString(formData, "email"));
  const displayName = getRequiredString(formData, "displayName");
  const password = getOptionalString(formData, "password");

  let passwordHash: string | null = null;
  if (password) {
    assertPasswordStrength(password);
    passwordHash = await bcrypt.hash(password, 12);
  }

  await prisma.user.update({
    where: { id },
    data: {
      email,
      displayName,
      ...(passwordHash ? { passwordHash } : {}),
    },
  });

  revalidatePath("/admin/users");
}
