"use client";

import { ExerciseVideoPreviewButton } from "@/app/dashboard/_components/exercise-video-preview-button";
import { X } from "lucide-react";
import { useState } from "react";
import { startWorkoutSessionAction } from "./actions";

type WorkoutPlanExercise = {
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

type WorkoutPlanCard = {
  dayOfWeek: number;
  dayLabel: string;
  trainingPlan: {
    id: string;
    name: string;
    description: string | null;
    videoUrl: string | null;
  };
  exercises: WorkoutPlanExercise[];
};

type WorkoutPlansClientProps = {
  week: number;
  plans: WorkoutPlanCard[];
};

function describeExercise(exercise: WorkoutPlanExercise) {
  if (exercise.exercise.metricType === "REPETITIONS" && exercise.reps) {
    return `${exercise.reps} Wdh.`;
  }

  if (exercise.exercise.metricType === "DURATION" && exercise.durationSec) {
    return `${exercise.durationSec}s`;
  }

  return "ohne Vorgabe";
}

export function WorkoutPlansClient({ week, plans }: WorkoutPlansClientProps) {
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlanCard | null>(
    null,
  );

  if (plans.length === 0) {
    return <p>Für diese Woche sind keine Workouts geplant.</p>;
  }

  return (
    <>
      <div className="path-card-grid">
        {plans.map((plan) => (
          <article
            key={`${plan.dayOfWeek}:${plan.trainingPlan.id}`}
            className="path-product-card workout-plan-card"
          >
            <button
              type="button"
              className="workout-plan-open"
              onClick={() => setSelectedPlan(plan)}
            >
              <div className="path-product-card-head">
                <strong>{plan.trainingPlan.name}</strong>
                <span className="calendar-day-tag">{plan.dayLabel}</span>
              </div>
              <p className="muted">
                {plan.exercises.length} Übung
                {plan.exercises.length === 1 ? "" : "en"}
              </p>
            </button>

            <form action={startWorkoutSessionAction} className="calendar-form">
              <input type="hidden" name="week" value={week} />
              <input type="hidden" name="dayOfWeek" value={plan.dayOfWeek} />
              <input type="hidden" name="startMode" value="DEFAULT" />
              <button type="submit">Session starten</button>
            </form>

            {plan.trainingPlan.videoUrl ? (
              <form
                action={startWorkoutSessionAction}
                className="calendar-form"
              >
                <input type="hidden" name="week" value={week} />
                <input type="hidden" name="dayOfWeek" value={plan.dayOfWeek} />
                <input type="hidden" name="startMode" value="VIDEO" />
                <button type="submit" className="training-secondary-button">
                  Mit Plan-Video starten
                </button>
              </form>
            ) : null}
          </article>
        ))}
      </div>

      {selectedPlan ? (
        <div
          className="path-modal-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.currentTarget === event.target) {
              setSelectedPlan(null);
            }
          }}
        >
          <section className="path-modal" role="dialog" aria-modal="true">
            <header className="path-modal-head">
              <div className="path-modal-title-wrap">
                <span className="path-product-chip">Workout Plan</span>
                <h3 className="path-modal-title">
                  {selectedPlan.trainingPlan.name}
                </h3>
                <p className="muted">{selectedPlan.dayLabel}</p>
              </div>
              <button
                type="button"
                className="path-modal-close"
                onClick={() => setSelectedPlan(null)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            {selectedPlan.trainingPlan.description ? (
              <p>{selectedPlan.trainingPlan.description}</p>
            ) : null}

            {selectedPlan.trainingPlan.videoUrl ? (
              <p>
                <a
                  href={selectedPlan.trainingPlan.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Plan-Video öffnen
                </a>
              </p>
            ) : null}

            {selectedPlan.exercises.length === 0 ? (
              <p>Dieser Trainingsplan enthält keine Übungen.</p>
            ) : (
              <ol className="workout-list">
                {selectedPlan.exercises.map((exercise) => {
                  return (
                    <li key={exercise.id} className="workout-modal-step">
                      <p>
                        <strong>{exercise.exercise.name}</strong> ·{" "}
                        {describeExercise(exercise)}
                        {exercise.restSec
                          ? ` · Pause ${exercise.restSec}s`
                          : ""}
                      </p>
                      {exercise.info ? (
                        <p className="muted">{exercise.info}</p>
                      ) : null}
                      <ExerciseVideoPreviewButton
                        exerciseName={exercise.exercise.name}
                        mediaUrl={exercise.exercise.mediaUrl}
                        compact
                      />
                    </li>
                  );
                })}
              </ol>
            )}

            <form action={startWorkoutSessionAction} className="calendar-form">
              <input type="hidden" name="week" value={week} />
              <input
                type="hidden"
                name="dayOfWeek"
                value={selectedPlan.dayOfWeek}
              />
              <input type="hidden" name="startMode" value="DEFAULT" />
              <button type="submit">Session starten</button>
            </form>

            {selectedPlan.trainingPlan.videoUrl ? (
              <form
                action={startWorkoutSessionAction}
                className="calendar-form"
              >
                <input type="hidden" name="week" value={week} />
                <input
                  type="hidden"
                  name="dayOfWeek"
                  value={selectedPlan.dayOfWeek}
                />
                <input type="hidden" name="startMode" value="VIDEO" />
                <button type="submit" className="training-secondary-button">
                  Mit Plan-Video starten
                </button>
              </form>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
