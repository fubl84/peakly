"use server";

import { auth } from "@/auth";
import { getOptionalString, getRequiredInt } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { resolveAssignmentsForEnrollmentWeek } from "@/lib/variant-resolver";
import { revalidatePath } from "next/cache";

type SessionLike = {
  user?: {
    id?: string;
    role?: string;
    email?: string | null;
  };
} | null;

function assertDayOfWeek(dayOfWeek: number) {
  if (dayOfWeek < 1 || dayOfWeek > 7) {
    throw new Error("Tag muss zwischen 1 und 7 liegen.");
  }
}

export async function upsertTrainingCalendarEntryAction(
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

  const week = getRequiredInt(formData, "week");
  const dayOfWeek = getRequiredInt(formData, "dayOfWeek");
  const trainingPlanId = getOptionalString(formData, "trainingPlanId");

  if (week < 1) {
    throw new Error("Woche muss größer oder gleich 1 sein.");
  }

  assertDayOfWeek(dayOfWeek);

  const enrollment = await prisma.userPathEnrollment.findFirst({
    where: { userId: session.user.id, isActive: true },
    include: {
      selectedVariants: {
        select: { variantOptionId: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!enrollment) {
    throw new Error("Keine aktive Teilnahme gefunden.");
  }

  const pathMaxWeek = await prisma.pathAssignment.aggregate({
    where: { pathId: enrollment.pathId },
    _max: { weekEnd: true },
  });

  const maxWeek = pathMaxWeek._max.weekEnd ?? 1;
  if (week > maxWeek) {
    throw new Error("Woche liegt außerhalb der Pfaddauer.");
  }

  const selectedVariantOptionIds = enrollment.selectedVariants.map(
    (entry: { variantOptionId: string }) => entry.variantOptionId,
  );

  const availableTrainingAssignments =
    await resolveAssignmentsForEnrollmentWeek({
      prismaClient: prisma,
      pathId: enrollment.pathId,
      week,
      selectedVariantOptionIds,
      kind: "TRAINING",
    });

  if (trainingPlanId) {
    const isAvailable = availableTrainingAssignments.some(
      (assignment: { contentRefId: string }) =>
        assignment.contentRefId === trainingPlanId,
    );

    if (!isAvailable) {
      throw new Error(
        "Der Trainingsplan ist in dieser Woche/Variante nicht verfügbar.",
      );
    }
  }

  await prisma.userTrainingCalendarEntry.upsert({
    where: {
      enrollmentId_week_dayOfWeek: {
        enrollmentId: enrollment.id,
        week,
        dayOfWeek,
      },
    },
    create: {
      userId: session.user.id,
      enrollmentId: enrollment.id,
      week,
      dayOfWeek,
      trainingPlanId,
      isRestDay: trainingPlanId === null,
    },
    update: {
      trainingPlanId,
      isRestDay: trainingPlanId === null,
    },
  });

  if (!args?.skipRevalidate) {
    revalidatePath("/dashboard/planner/training");
  }
}

export async function deleteTrainingCalendarEntryAction(
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

  const week = getRequiredInt(formData, "week");
  const dayOfWeek = getRequiredInt(formData, "dayOfWeek");

  if (week < 1) {
    throw new Error("Woche muss größer oder gleich 1 sein.");
  }

  assertDayOfWeek(dayOfWeek);

  const enrollment = await prisma.userPathEnrollment.findFirst({
    where: { userId: session.user.id, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (!enrollment) {
    throw new Error("Keine aktive Teilnahme gefunden.");
  }

  await prisma.userTrainingCalendarEntry.deleteMany({
    where: {
      enrollmentId: enrollment.id,
      week,
      dayOfWeek,
    },
  });

  if (!args?.skipRevalidate) {
    revalidatePath("/dashboard/planner/training");
  }
}
