"use server";

import { auth } from "@/auth";
import {
  getOptionalNumber,
  getOptionalString,
  getRequiredString,
} from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

async function requireUserId() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Nicht angemeldet.");
  }

  return session.user.id;
}

type CoachTone = "SUPPORTIVE" | "DIRECT" | "PERFORMANCE" | "ANALYTICAL";

const prismaWithCoachProfile = prisma as unknown as {
  userCoachProfile: {
    upsert: (args: unknown) => Promise<unknown>;
  };
};

function normalizeCoachTone(value: string | null): CoachTone {
  if (
    value === "SUPPORTIVE" ||
    value === "DIRECT" ||
    value === "PERFORMANCE" ||
    value === "ANALYTICAL"
  ) {
    return value;
  }

  return "SUPPORTIVE";
}

export async function updateUserSettingsAction(formData: FormData) {
  const userId = await requireUserId();

  const displayName = getOptionalString(formData, "displayName");
  const currentWeightKg = getOptionalNumber(formData, "currentWeightKg");
  const heightCmRaw = getOptionalNumber(formData, "heightCm");
  const ageRaw = getOptionalNumber(formData, "age");
  const gender = getOptionalString(formData, "gender");
  const activityLevel = getOptionalString(formData, "activityLevel");
  const pathGoal = getOptionalString(formData, "pathGoal");
  const geminiApiKey = getOptionalString(formData, "geminiApiKey");
  const coachTone = normalizeCoachTone(
    getOptionalString(formData, "coachTone"),
  );
  const coachConstraints = getOptionalString(formData, "coachConstraints");
  const trainingPreferences = getOptionalString(
    formData,
    "trainingPreferences",
  );
  const nutritionPreferences = getOptionalString(
    formData,
    "nutritionPreferences",
  );

  const heightCm = heightCmRaw === null ? null : Math.round(heightCmRaw);
  const age = ageRaw === null ? null : Math.round(ageRaw);

  if (
    currentWeightKg !== null &&
    (currentWeightKg <= 0 || currentWeightKg > 500)
  ) {
    throw new Error("Gewicht muss zwischen 1 und 500 kg liegen.");
  }

  if (heightCm !== null && (heightCm < 90 || heightCm > 260)) {
    throw new Error("Größe muss zwischen 90 und 260 cm liegen.");
  }

  if (age !== null && (age < 12 || age > 120)) {
    throw new Error("Alter muss zwischen 12 und 120 liegen.");
  }

  if (displayName !== null && displayName.length > 80) {
    throw new Error("Name darf maximal 80 Zeichen lang sein.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      displayName,
    },
  });

  await prisma.userSetting.upsert({
    where: { userId },
    create: {
      userId,
      currentWeightKg,
      heightCm,
      age,
      gender,
      activityLevel,
      pathGoal,
      geminiApiKey,
    },
    update: {
      currentWeightKg,
      heightCm,
      age,
      gender,
      activityLevel,
      pathGoal,
      ...(geminiApiKey !== null ? { geminiApiKey } : {}),
    },
  });

  await prismaWithCoachProfile.userCoachProfile.upsert({
    where: { userId },
    create: {
      userId,
      tone: coachTone,
      constraints: coachConstraints,
      trainingPreferences,
      nutritionPreferences,
    },
    update: {
      tone: coachTone,
      constraints: coachConstraints,
      trainingPreferences,
      nutritionPreferences,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");
}

export async function clearGeminiApiKeyAction() {
  const userId = await requireUserId();

  await prisma.userSetting.upsert({
    where: { userId },
    create: {
      userId,
      geminiApiKey: null,
    },
    update: {
      geminiApiKey: null,
    },
  });

  revalidatePath("/dashboard/settings");
}

export async function changePasswordAction(formData: FormData) {
  const userId = await requireUserId();
  const currentPassword = getRequiredString(formData, "currentPassword");
  const newPassword = getRequiredString(formData, "newPassword");
  const confirmPassword = getRequiredString(formData, "confirmPassword");

  if (newPassword.length < 8) {
    throw new Error("Neues Passwort muss mindestens 8 Zeichen lang sein.");
  }

  if (newPassword !== confirmPassword) {
    throw new Error("Passwort-Bestätigung stimmt nicht überein.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });

  if (!user) {
    throw new Error("Benutzer nicht gefunden.");
  }

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) {
    throw new Error("Aktuelles Passwort ist falsch.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });
}
