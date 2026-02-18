import { requireAuth } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { compareTrainingExerciseOrder } from "@/lib/training-block-order";
import { resolveEnrollmentWeek } from "@/lib/week-resolver";
import Link from "next/link";
import { PlannerWeekHeader } from "../_components/planner-week-header";
import { WorkoutPlansClient } from "./workout-plans-client";

type SearchParamValue = string | string[] | undefined;

type WorkoutPageProps = {
  searchParams?: Promise<Record<string, SearchParamValue>>;
};

type PlannedWorkout = {
  dayOfWeek: number;
  trainingPlan: {
    id: string;
    name: string;
    description: string | null;
    videoUrl: string | null;
    trainingExercises: Array<{
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
    }>;
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

function dayLabel(dayOfWeek: number) {
  return (
    DAY_LABELS.find((entry) => entry.day === dayOfWeek)?.label ??
    `Tag ${dayOfWeek}`
  );
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

export default async function WorkoutPage(props: WorkoutPageProps) {
  const session = await requireAuth();
  const params = (await props.searchParams) ?? {};

  const enrollment = await prisma.userPathEnrollment.findFirst({
    where: { userId: session.user.id, isActive: true },
    include: {
      path: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!enrollment) {
    return (
      <main className="dashboard-page">
        <h1 className="page-title">Live Workout</h1>
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

  const plannedWorkouts = (await prisma.userTrainingCalendarEntry.findMany({
    where: {
      enrollmentId: enrollment.id,
      week,
      trainingPlanId: { not: null },
    },
    include: {
      trainingPlan: {
        select: {
          id: true,
          name: true,
          description: true,
          videoUrl: true,
          trainingExercises: {
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
          },
        },
      },
    },
    orderBy: { dayOfWeek: "asc" },
  })) as PlannedWorkout[];

  const activeSession = await prisma.userWorkoutSession.findFirst({
    where: {
      userId: session.user.id,
      week,
      status: "ACTIVE",
    },
    include: {
      trainingPlan: {
        select: { id: true, name: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="dashboard-page">
      <h1 className="page-title">Live Workout</h1>
      <Link className="back-link" href="/dashboard">
        Zurück zum Dashboard
      </Link>

      <PlannerWeekHeader
        pathName="/dashboard/workout"
        week={week}
        maxWeek={maxWeek}
        currentWeek={currentWeek}
        dateRangeLabel={weekDateRangeLabel}
        pathNameLabel={enrollment.path.name}
      />

      <section className="card stack">
        <h2 className="section-title">Workout-Pläne dieser Woche</h2>
        <p className="muted">
          Öffne einen Plan als Karte, prüfe die Übungsdetails im Modal und
          starte direkt deine Session.
        </p>
        <WorkoutPlansClient
          week={week}
          plans={plannedWorkouts.map((entry) => {
            const sortedExercises = [
              ...entry.trainingPlan.trainingExercises,
            ].sort(compareTrainingExerciseOrder);

            return {
              dayOfWeek: entry.dayOfWeek,
              dayLabel: dayLabel(entry.dayOfWeek),
              trainingPlan: {
                id: entry.trainingPlan.id,
                name: entry.trainingPlan.name,
                description: entry.trainingPlan.description,
                videoUrl: entry.trainingPlan.videoUrl,
              },
              exercises: sortedExercises.map((exercise) => ({
                id: exercise.id,
                block: exercise.block,
                position: exercise.position,
                reps: exercise.reps,
                durationSec: exercise.durationSec,
                restSec: exercise.restSec,
                info: exercise.info,
                exercise: {
                  name: exercise.exercise.name,
                  metricType: exercise.exercise.metricType,
                  mediaUrl: exercise.exercise.mediaUrl,
                },
              })),
            };
          })}
        />
      </section>

      <section className="card stack">
        <h2 className="section-title">Aktive Session</h2>
        {!activeSession ? (
          <p>Keine aktive Session in dieser Woche.</p>
        ) : (
          <>
            <p>
              <strong>{activeSession.trainingPlan.name}</strong> ·{" "}
              {dayLabel(activeSession.dayOfWeek)}
            </p>
            <Link
              className="week-nav-button"
              href={`/dashboard/workout/session?sessionId=${activeSession.id}`}
            >
              Zur Live-Session
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
