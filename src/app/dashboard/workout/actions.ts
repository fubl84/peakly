"use server";

import { auth } from "@/auth";
import { getRequiredInt, getRequiredString } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function assertDayOfWeek(dayOfWeek: number) {
  if (dayOfWeek < 1 || dayOfWeek > 7) {
    throw new Error("Tag muss zwischen 1 und 7 liegen.");
  }
}

async function resolveEnrollmentForWeek(userId: string, week: number) {
  const enrollment = await prisma.userPathEnrollment.findFirst({
    where: { userId, isActive: true },
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
  if (week < 1 || week > maxWeek) {
    throw new Error("Woche liegt außerhalb der Pfaddauer.");
  }

  return enrollment;
}

export async function startWorkoutSessionAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Nicht angemeldet.");
  }

  const week = getRequiredInt(formData, "week");
  const dayOfWeek = getRequiredInt(formData, "dayOfWeek");
  const startModeRaw = String(formData.get("startMode") ?? "DEFAULT").trim();
  const startMode = startModeRaw === "VIDEO" ? "VIDEO" : "DEFAULT";

  assertDayOfWeek(dayOfWeek);
  const enrollment = await resolveEnrollmentForWeek(session.user.id, week);

  const plannedEntry = await prisma.userTrainingCalendarEntry.findFirst({
    where: {
      enrollmentId: enrollment.id,
      week,
      dayOfWeek,
      trainingPlanId: { not: null },
    },
    select: {
      trainingPlanId: true,
      trainingPlan: {
        select: {
          videoUrl: true,
        },
      },
    },
  });

  if (!plannedEntry?.trainingPlanId) {
    throw new Error("Für diesen Tag ist kein Trainingsplan geplant.");
  }

  const activeSession = await prisma.userWorkoutSession.findFirst({
    where: {
      enrollmentId: enrollment.id,
      week,
      dayOfWeek,
      status: "ACTIVE",
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  let sessionId = activeSession?.id ?? "";

  if (activeSession) {
    await prisma.userWorkoutSession.update({
      where: { id: activeSession.id },
      data: {
        trainingPlanId: plannedEntry.trainingPlanId,
        currentStepIndex: 0,
        startedAt: new Date(),
        completedAt: null,
      },
    });
  } else {
    const created = await prisma.userWorkoutSession.create({
      data: {
        userId: session.user.id,
        enrollmentId: enrollment.id,
        trainingPlanId: plannedEntry.trainingPlanId,
        week,
        dayOfWeek,
      },
      select: {
        id: true,
      },
    });
    sessionId = created.id;
  }

  revalidatePath("/dashboard/workout");
  revalidatePath("/dashboard/workout/session");
  const openVideoMode =
    startMode === "VIDEO" && Boolean(plannedEntry.trainingPlan?.videoUrl);
  redirect(
    `/dashboard/workout/session?sessionId=${sessionId}${openVideoMode ? "&mode=video" : ""}`,
  );
}

export async function advanceWorkoutStepAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Nicht angemeldet.");
  }

  const sessionId = getRequiredString(formData, "sessionId");

  const workoutSession = await prisma.userWorkoutSession.findFirst({
    where: {
      id: sessionId,
      userId: session.user.id,
      status: "ACTIVE",
    },
    select: {
      id: true,
      currentStepIndex: true,
      trainingPlanId: true,
    },
  });

  if (!workoutSession) {
    throw new Error("Aktive Workout-Session nicht gefunden.");
  }

  const totalSteps = await prisma.trainingPlanExercise.count({
    where: { trainingPlanId: workoutSession.trainingPlanId },
  });

  if (totalSteps === 0) {
    await prisma.userWorkoutSession.update({
      where: { id: workoutSession.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    revalidatePath("/dashboard/workout");
    revalidatePath("/dashboard/workout/session");
    return;
  }

  const nextIndex = workoutSession.currentStepIndex + 1;

  if (nextIndex >= totalSteps) {
    await prisma.userWorkoutSession.update({
      where: { id: workoutSession.id },
      data: {
        currentStepIndex: totalSteps - 1,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
  } else {
    await prisma.userWorkoutSession.update({
      where: { id: workoutSession.id },
      data: {
        currentStepIndex: nextIndex,
      },
    });
  }

  revalidatePath("/dashboard/workout");
  revalidatePath("/dashboard/workout/session");
}

export async function retreatWorkoutStepAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Nicht angemeldet.");
  }

  const sessionId = getRequiredString(formData, "sessionId");

  const workoutSession = await prisma.userWorkoutSession.findFirst({
    where: {
      id: sessionId,
      userId: session.user.id,
      status: "ACTIVE",
    },
    select: {
      id: true,
      currentStepIndex: true,
    },
  });

  if (!workoutSession) {
    throw new Error("Aktive Workout-Session nicht gefunden.");
  }

  const previousIndex = Math.max(0, workoutSession.currentStepIndex - 1);

  await prisma.userWorkoutSession.update({
    where: { id: workoutSession.id },
    data: {
      currentStepIndex: previousIndex,
    },
  });

  revalidatePath("/dashboard/workout");
  revalidatePath("/dashboard/workout/session");
}

export async function completeWorkoutSessionAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Nicht angemeldet.");
  }

  const sessionId = getRequiredString(formData, "sessionId");

  const workoutSession = await prisma.userWorkoutSession.findFirst({
    where: {
      id: sessionId,
      userId: session.user.id,
      status: "ACTIVE",
    },
    select: { id: true, week: true },
  });

  if (!workoutSession) {
    throw new Error("Aktive Workout-Session nicht gefunden.");
  }

  await prisma.userWorkoutSession.update({
    where: { id: workoutSession.id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });

  revalidatePath("/dashboard/workout");
  revalidatePath("/dashboard/workout/session");
  redirect(`/dashboard/workout?week=${workoutSession.week}`);
}
