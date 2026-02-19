"use server";

import { auth } from "@/auth";
import { createEnrollment } from "@/lib/enrollment-service";
import {
  getOptionalNumber,
  getOptionalString,
  getRequiredString,
} from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type SessionLike = {
  user?: {
    id?: string;
    role?: string;
    email?: string | null;
  };
} | null;

type WeeklyCheckInType = "MONDAY_PLAN" | "SUNDAY_RECAP";

const prismaWithWeeklyCheckIn = prisma as unknown as {
  userWeeklyCheckIn: {
    upsert: (args: unknown) => Promise<unknown>;
  };
};

function toIsoWeekParts(date: Date) {
  const copy = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((copy.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );

  return {
    isoYear: copy.getUTCFullYear(),
    isoWeek: week,
  };
}

function normalizeCheckInType(value: string): WeeklyCheckInType {
  if (value === "MONDAY_PLAN" || value === "SUNDAY_RECAP") {
    return value;
  }

  throw new Error("Ungültiger Check-In Typ.");
}

function normalizeLevel(value: number | null, fieldName: string) {
  if (value === null) {
    return null;
  }

  const rounded = Math.round(value);
  if (rounded < 1 || rounded > 10) {
    throw new Error(`${fieldName} muss zwischen 1 und 10 liegen.`);
  }

  return rounded;
}

export async function createEnrollmentAction(
  formData: FormData,
  args?: { session?: SessionLike; skipRevalidate?: boolean },
) {
  const session =
    args && "session" in args
      ? (args.session ?? null)
      : ((await auth()) as SessionLike);

  if (!session?.user?.id) {
    throw new Error("Nicht angemeldet.");
  }

  const pathId = getRequiredString(formData, "pathId");
  const startDateRaw = getRequiredString(formData, "startDate");
  const startDate = new Date(startDateRaw);

  if (Number.isNaN(startDate.getTime())) {
    throw new Error("Ungültiges Startdatum.");
  }

  const variants = await prisma.variant.findMany({
    orderBy: [{ kind: "asc" }, { name: "asc" }],
  });

  const selectedVariantIds = ["TRAINING", "NUTRITION"]
    .map((kind) => String(formData.get(`variantKind:${kind}`) ?? "").trim())
    .filter(Boolean);

  const selectedVariants = selectedVariantIds
    .filter((variantId) => variants.some((variant) => variant.id === variantId))
    .map((variantId) => ({ variantId }));

  await createEnrollment({
    userId: session.user.id,
    pathId,
    startDate,
    selectedVariants,
  });

  if (!args?.skipRevalidate) {
    revalidatePath("/dashboard");
  }
}

export async function upsertWeeklyCheckInAction(formData: FormData) {
  const session = (await auth()) as SessionLike;
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Nicht angemeldet.");
  }

  const checkInType = normalizeCheckInType(
    getRequiredString(formData, "checkInType"),
  );
  const energyLevel = normalizeLevel(
    getOptionalNumber(formData, "energyLevel"),
    "Energie",
  );
  const stressLevel = normalizeLevel(
    getOptionalNumber(formData, "stressLevel"),
    "Stress",
  );
  const sleepQualityLevel = normalizeLevel(
    getOptionalNumber(formData, "sleepQualityLevel"),
    "Schlafqualität",
  );
  const adherenceLevel = normalizeLevel(
    getOptionalNumber(formData, "adherenceLevel"),
    "Umsetzung",
  );
  const note = getOptionalString(formData, "note");

  const enrollment = await prisma.userPathEnrollment.findFirst({
    where: { userId, isActive: true },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  const { isoYear, isoWeek } = toIsoWeekParts(new Date());

  await prismaWithWeeklyCheckIn.userWeeklyCheckIn.upsert({
    where: {
      userId_year_week_type: {
        userId,
        year: isoYear,
        week: isoWeek,
        type: checkInType,
      },
    },
    create: {
      userId,
      enrollmentId: enrollment?.id ?? null,
      year: isoYear,
      week: isoWeek,
      type: checkInType,
      energyLevel,
      stressLevel,
      sleepQualityLevel,
      adherenceLevel,
      note,
    },
    update: {
      enrollmentId: enrollment?.id ?? null,
      energyLevel,
      stressLevel,
      sleepQualityLevel,
      adherenceLevel,
      note,
    },
  });

  revalidatePath("/dashboard");
}
