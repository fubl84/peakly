import { requireAuth } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { compareTrainingExerciseOrder } from "@/lib/training-block-order";
import Link from "next/link";
import { WorkoutSessionClient } from "../workout-session-client";

type SearchParamValue = string | string[] | undefined;

type WorkoutSessionPageProps = {
  searchParams?: Promise<Record<string, SearchParamValue>>;
};

type SessionExercise = {
  id: string;
  block: string;
  position: number;
  reps: number | null;
  durationSec: number | null;
  restSec: number | null;
  info: string | null;
  exercise: {
    name: string;
    metricType: string;
    mediaUrl: string | null;
  };
};

const DAY_LABELS = [
  { day: 1, label: "Montag" },
  { day: 2, label: "Dienstag" },
  { day: 3, label: "Mittwoch" },
  { day: 4, label: "Donnerstag" },
  { day: 5, label: "Freitag" },
  { day: 6, label: "Samstag" },
  { day: 7, label: "Sonntag" },
] as const;

function toSingle(value: SearchParamValue) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function dayLabel(dayOfWeek: number) {
  return (
    DAY_LABELS.find((entry) => entry.day === dayOfWeek)?.label ??
    `Tag ${dayOfWeek}`
  );
}

export default async function WorkoutSessionPage(
  props: WorkoutSessionPageProps,
) {
  const session = await requireAuth();
  const params = (await props.searchParams) ?? {};
  const requestedSessionId = toSingle(params.sessionId);
  const startMode = toSingle(params.mode) === "video" ? "video" : "default";

  const activeSession = await prisma.userWorkoutSession.findFirst({
    where: {
      userId: session.user.id,
      status: "ACTIVE",
      ...(requestedSessionId ? { id: requestedSessionId } : {}),
    },
    include: {
      trainingPlan: {
        select: {
          id: true,
          name: true,
          videoUrl: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!activeSession) {
    return (
      <main className="dashboard-page">
        <h1 className="page-title">Workout Session</h1>
        <p>Keine aktive Session gefunden.</p>
        <Link className="week-nav-button" href="/dashboard/workout">
          Zurück zu Workout
        </Link>
      </main>
    );
  }

  const steps = (await prisma.trainingPlanExercise.findMany({
    where: { trainingPlanId: activeSession.trainingPlanId },
    select: {
      id: true,
      block: true,
      position: true,
      reps: true,
      durationSec: true,
      restSec: true,
      info: true,
      exercise: {
        select: {
          name: true,
          metricType: true,
          mediaUrl: true,
        },
      },
    },
    orderBy: { position: "asc" },
  })) as SessionExercise[];

  const sortedSteps = [...steps].sort(compareTrainingExerciseOrder);

  return (
    <main className="dashboard-page workout-session-page">
      <h1 className="page-title">Workout Session</h1>
      <Link
        className="back-link"
        href={`/dashboard/workout?week=${activeSession.week}`}
      >
        Zurück zu Workout
      </Link>

      <WorkoutSessionClient
        key={`${activeSession.id}:${activeSession.currentStepIndex}`}
        sessionId={activeSession.id}
        planName={activeSession.trainingPlan.name}
        planVideoUrl={activeSession.trainingPlan.videoUrl}
        dayLabel={dayLabel(activeSession.dayOfWeek)}
        currentStepIndex={activeSession.currentStepIndex}
        steps={sortedSteps}
        startMode={startMode}
      />
    </main>
  );
}
