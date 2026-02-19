import { requireAuth } from "@/lib/access";
import { resolveUserInfoBlocksForWeek } from "@/lib/info-blocks";
import { prisma } from "@/lib/prisma";
import { resolveAssignmentsForEnrollmentWeek } from "@/lib/variant-resolver";
import { resolveEnrollmentWeek } from "@/lib/week-resolver";
import Link from "next/link";
import { InfoBlockFeed } from "../../_components/info-block-feed";
import { PlannerWeekHeader } from "../../_components/planner-week-header";
import { TrainingPlannerClient } from "./training-planner-client";

type SearchParamValue = string | string[] | undefined;

type TrainingPlannerPageProps = {
  searchParams?: Promise<Record<string, SearchParamValue>>;
};

type TrainingCalendarEntry = {
  id: string;
  dayOfWeek: number;
  trainingPlanId: string | null;
  isRestDay: boolean;
  trainingPlan: {
    id: string;
    name: string;
  } | null;
};

type TrainingPlanOption = {
  id: string;
  name: string;
};

type TrainingPlanExerciseRow = {
  id: string;
  trainingPlanId: string;
  block: string;
  position: number;
  reps: number | null;
  durationSec: number | null;
  restSec: number | null;
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

function clampWeek(week: number, maxWeek: number) {
  if (week < 1) return 1;
  if (week > maxWeek) return maxWeek;
  return week;
}

function formatWeekDateRangeLabel(startDate: Date, week: number) {
  const weekStart = new Date(startDate);
  weekStart.setDate(weekStart.getDate() + (week - 1) * 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const formatter = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
  });

  return `${formatter.format(weekStart)} - ${formatter.format(weekEnd)}`;
}

export default async function TrainingPlannerPage(
  props: TrainingPlannerPageProps,
) {
  const session = await requireAuth();
  const params = (await props.searchParams) ?? {};

  const enrollment = await prisma.userPathEnrollment.findFirst({
    where: { userId: session.user.id, isActive: true },
    include: {
      selectedVariants: {
        select: { variantId: true },
      },
      path: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!enrollment) {
    return (
      <main className="dashboard-page">
        <h1 className="page-title">Trainingsplaner</h1>
        <p>Keine aktive Teilnahme gefunden. Starte zuerst einen Pfad.</p>
        <Link className="back-link" href="/dashboard">
          Zurück zum Dashboard
        </Link>
      </main>
    );
  }

  const pathMaxWeek = await prisma.pathAssignment.aggregate({
    where: { pathId: enrollment.pathId },
    _max: { weekEnd: true },
  });

  const maxWeek = Math.max(pathMaxWeek._max.weekEnd ?? 1, 1);
  const currentEnrollmentWeek = resolveEnrollmentWeek({
    startDate: enrollment.startDate,
    maxWeeks: maxWeek,
  });

  const requestedWeek = Number.parseInt(toSingle(params.week), 10);
  const week = clampWeek(
    Number.isNaN(requestedWeek)
      ? currentEnrollmentWeek > 0
        ? currentEnrollmentWeek
        : 1
      : requestedWeek,
    maxWeek,
  );
  const currentWeek = clampWeek(
    currentEnrollmentWeek > 0 ? currentEnrollmentWeek : 1,
    maxWeek,
  );
  const weekDateRangeLabel = formatWeekDateRangeLabel(
    enrollment.startDate,
    week,
  );

  const selectedVariantIds = enrollment.selectedVariants.map(
    (entry: { variantId: string }) => entry.variantId,
  );

  const assignments = await resolveAssignmentsForEnrollmentWeek({
    prismaClient: prisma,
    pathId: enrollment.pathId,
    week,
    selectedVariantIds,
    kind: "TRAINING",
  });

  const availableTrainingPlanIds = Array.from(
    new Set(
      assignments.map(
        (assignment: { contentRefId: string }) => assignment.contentRefId,
      ),
    ),
  );

  const availableTrainingPlans = (await prisma.trainingPlan.findMany({
    where: { id: { in: availableTrainingPlanIds } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })) as TrainingPlanOption[];

  const planExercises = (await prisma.trainingPlanExercise.findMany({
    where: { trainingPlanId: { in: availableTrainingPlanIds } },
    include: {
      exercise: {
        select: {
          name: true,
          metricType: true,
          mediaUrl: true,
        },
      },
    },
    orderBy: [{ block: "asc" }, { position: "asc" }],
  })) as TrainingPlanExerciseRow[];

  const entries = (await prisma.userTrainingCalendarEntry.findMany({
    where: {
      enrollmentId: enrollment.id,
      week,
    },
    include: {
      trainingPlan: {
        select: { id: true, name: true },
      },
    },
    orderBy: { dayOfWeek: "asc" },
  })) as TrainingCalendarEntry[];

  const entryByDay = new Map<number, TrainingCalendarEntry>(
    entries.map((entry: TrainingCalendarEntry) => [entry.dayOfWeek, entry]),
  );
  const exercisesByPlanId = new Map<string, TrainingPlanExerciseRow[]>(
    availableTrainingPlans.map((plan) => [
      plan.id,
      planExercises.filter((exercise) => exercise.trainingPlanId === plan.id),
    ]),
  );

  const dayAssignments = DAY_LABELS.map((day) => {
    const entry = entryByDay.get(day.day);

    return {
      dayOfWeek: day.day,
      dayLabel: day.label,
      entryId: entry?.id ?? null,
      trainingPlanId: entry?.trainingPlanId ?? null,
      trainingPlanName: entry?.trainingPlan?.name ?? null,
      isRestDay: entry?.trainingPlanId ? false : true,
    };
  });

  const availablePlans = availableTrainingPlans.map((plan) => {
    const exercises = exercisesByPlanId.get(plan.id) ?? [];

    return {
      id: plan.id,
      name: plan.name,
      exerciseCount: exercises.length,
      warmupCount: exercises.filter((entry) => entry.block === "WARMUP").length,
      setCount: exercises.filter((entry) => entry.block.startsWith("SET-"))
        .length,
      cooldownCount: exercises.filter((entry) => entry.block === "COOLDOWN")
        .length,
      exercises: exercises.map((entry) => ({
        id: entry.id,
        block: entry.block,
        position: entry.position,
        reps: entry.reps,
        durationSec: entry.durationSec,
        restSec: entry.restSec,
        exerciseName: entry.exercise.name,
        metricType: entry.exercise.metricType,
        mediaUrl: entry.exercise.mediaUrl,
      })),
    };
  });

  const workoutInfoBlocks = await resolveUserInfoBlocksForWeek({
    prismaClient: prisma,
    userId: session.user.id,
    pathId: enrollment.pathId,
    week,
    selectedVariantIds,
    categories: ["WORKOUT"],
  });

  return (
    <main className="dashboard-page">
      {workoutInfoBlocks.length > 0 ? (
        <InfoBlockFeed
          blocks={workoutInfoBlocks}
          variant="banner"
          title="Workout-Info"
        />
      ) : null}

      <h1 className="page-title">Trainingsplaner</h1>
      <Link className="back-link" href="/dashboard">
        Zurück zum Dashboard
      </Link>

      <PlannerWeekHeader
        pathName="/dashboard/planner/training"
        week={week}
        maxWeek={maxWeek}
        currentWeek={currentWeek}
        dateRangeLabel={weekDateRangeLabel}
        pathNameLabel={enrollment.path.name}
      />

      <TrainingPlannerClient
        week={week}
        dayAssignments={dayAssignments}
        availablePlans={availablePlans}
      />
    </main>
  );
}
