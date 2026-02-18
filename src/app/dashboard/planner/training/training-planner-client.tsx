"use client";

import { ExerciseVideoPreviewButton } from "@/app/dashboard/_components/exercise-video-preview-button";
import { ChevronRight, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  deleteTrainingCalendarEntryAction,
  upsertTrainingCalendarEntryAction,
} from "./actions";

type DayAssignment = {
  dayOfWeek: number;
  dayLabel: string;
  entryId: string | null;
  trainingPlanId: string | null;
  trainingPlanName: string | null;
  isRestDay: boolean;
};

type TrainingPlanExercise = {
  id: string;
  block: string;
  position: number;
  reps: number | null;
  durationSec: number | null;
  restSec: number | null;
  exerciseName: string;
  metricType: string;
  mediaUrl: string | null;
};

type TrainingPlanCatalog = {
  id: string;
  name: string;
  exerciseCount: number;
  warmupCount: number;
  setCount: number;
  cooldownCount: number;
  exercises: TrainingPlanExercise[];
};

type TrainingPlannerClientProps = {
  week: number;
  dayAssignments: DayAssignment[];
  availablePlans: TrainingPlanCatalog[];
};

type AssignModalState = {
  dayOfWeek: number;
  dayLabel: string;
  currentPlanId: string | null;
  currentPlanName: string | null;
};

type DeleteModalState = {
  dayOfWeek: number;
  dayLabel: string;
  planName: string;
};

function describeExerciseStep(step: TrainingPlanExercise) {
  if (step.metricType === "REPETITIONS" && step.reps) {
    return `${step.reps} Wdh.`;
  }

  if (step.metricType === "DURATION" && step.durationSec) {
    return `${step.durationSec}s`;
  }

  return "ohne Vorgabe";
}

function describeBlock(block: string) {
  if (block === "WARMUP") {
    return "Warm-up";
  }

  if (block === "COOLDOWN") {
    return "Cooldown";
  }

  if (block.startsWith("SET-")) {
    const setIndex = Number(block.replace("SET-", ""));
    return Number.isInteger(setIndex) ? `Set ${setIndex}` : "Set";
  }

  return block;
}

function blockSortRank(block: string) {
  if (block === "WARMUP") return 1;
  if (block.startsWith("SET-")) {
    const setIndex = Number(block.replace("SET-", ""));
    return Number.isInteger(setIndex) ? 100 + setIndex : 150;
  }
  if (block === "COOLDOWN") return 1000;
  return 500;
}

export function TrainingPlannerClient({
  week,
  dayAssignments,
  availablePlans,
}: TrainingPlannerClientProps) {
  const [assignModal, setAssignModal] = useState<AssignModalState | null>(null);
  const [deleteModal, setDeleteModal] = useState<DeleteModalState | null>(null);
  const [previewPlanId, setPreviewPlanId] = useState<string | null>(null);

  const hasOpenModal = Boolean(assignModal || deleteModal || previewPlanId);

  useEffect(() => {
    if (!hasOpenModal) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAssignModal(null);
        setDeleteModal(null);
        setPreviewPlanId(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [hasOpenModal]);

  const previewPlan = useMemo(
    () => availablePlans.find((plan) => plan.id === previewPlanId) ?? null,
    [availablePlans, previewPlanId],
  );

  const previewPlanGroupedBlocks = useMemo(() => {
    if (!previewPlan) {
      return [] as Array<{
        block: string;
        label: string;
        steps: TrainingPlanExercise[];
      }>;
    }

    const groups = new Map<string, TrainingPlanExercise[]>();
    for (const step of previewPlan.exercises) {
      const existing = groups.get(step.block) ?? [];
      existing.push(step);
      groups.set(step.block, existing);
    }

    return [...groups.entries()]
      .sort((a, b) => blockSortRank(a[0]) - blockSortRank(b[0]))
      .map(([block, steps]) => ({
        block,
        label: describeBlock(block),
        steps: [...steps].sort((a, b) => a.position - b.position),
      }));
  }, [previewPlan]);

  return (
    <>
      <section className="card stack">
        <h2 className="section-title">Trainingskalender</h2>
        <p className="muted">
          Saubere Wochenübersicht. Anpassungen machst du über das Plus-Symbol.
        </p>

        <div className="calendar-grid">
          {dayAssignments.map((day) => (
            <article
              key={day.dayOfWeek}
              className="calendar-day training-day-card"
            >
              <div className="calendar-day-title">
                <strong>{day.dayLabel}</strong>
                <span className="calendar-day-tag">
                  {day.trainingPlanId ? "Training geplant" : "Ruhetag"}
                </span>
              </div>

              {day.trainingPlanId && day.trainingPlanName ? (
                <div className="training-day-assignment-wrap">
                  <button
                    type="button"
                    className="training-assignment-card"
                    onClick={() => setPreviewPlanId(day.trainingPlanId)}
                  >
                    <strong>{day.trainingPlanName}</strong>
                    <span>Details anzeigen</span>
                  </button>

                  <button
                    type="button"
                    className="training-icon-button is-danger"
                    aria-label={`Plan für ${day.dayLabel} löschen`}
                    onClick={() =>
                      setDeleteModal({
                        dayOfWeek: day.dayOfWeek,
                        dayLabel: day.dayLabel,
                        planName: day.trainingPlanName ?? "Unbekannter Plan",
                      })
                    }
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <p className="muted">Kein Training eingeplant.</p>
              )}

              <button
                type="button"
                className="training-add-button"
                onClick={() =>
                  setAssignModal({
                    dayOfWeek: day.dayOfWeek,
                    dayLabel: day.dayLabel,
                    currentPlanId: day.trainingPlanId,
                    currentPlanName: day.trainingPlanName,
                  })
                }
                disabled={availablePlans.length === 0}
              >
                <Plus size={16} aria-hidden="true" /> Plan hinzufügen
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="card stack">
        <h2 className="section-title">
          Verfügbare Trainingspläne dieser Woche
        </h2>

        {availablePlans.length === 0 ? (
          <p>Für diese Woche sind keine Trainingspläne verfügbar.</p>
        ) : (
          <div className="training-plan-product-grid">
            {availablePlans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                className="training-plan-product-card"
                onClick={() => setPreviewPlanId(plan.id)}
              >
                <div className="training-plan-card-head">
                  <span className="path-product-chip">Training</span>
                  <span className="training-plan-card-meta">
                    {plan.exerciseCount} Übungen
                  </span>
                </div>

                <h3 className="training-plan-card-title">{plan.name}</h3>

                <div className="training-plan-card-stats">
                  <span>{plan.warmupCount}× Warm-up</span>
                  <span>{plan.setCount}× Set</span>
                  <span>{plan.cooldownCount}× Cooldown</span>
                </div>

                <span className="path-product-cta">
                  Plan ansehen <ChevronRight size={14} aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {previewPlan ? (
        <div
          className="path-modal-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.currentTarget === event.target) {
              setPreviewPlanId(null);
            }
          }}
        >
          <section
            className="path-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Trainingsplan ${previewPlan.name}`}
          >
            <header className="path-modal-head">
              <div className="path-modal-title-wrap">
                <span className="path-product-chip">Trainingsplan</span>
                <h3 className="path-modal-title">{previewPlan.name}</h3>
                <p className="muted">Übersicht über alle Übungsblöcke.</p>
              </div>

              <button
                type="button"
                className="path-modal-close"
                onClick={() => setPreviewPlanId(null)}
                aria-label="Planvorschau schließen"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            {previewPlan.exercises.length === 0 ? (
              <p className="path-modal-empty">
                Dieser Trainingsplan enthält noch keine Übungen.
              </p>
            ) : (
              <div className="training-plan-step-list">
                {previewPlanGroupedBlocks.map((group) => (
                  <section
                    key={group.block}
                    className="training-plan-block-group"
                  >
                    <h4 className="training-plan-block-title">{group.label}</h4>

                    <div className="training-plan-block-steps">
                      {group.steps.map((step) => (
                        <article key={step.id} className="path-assignment-card">
                          <p className="training-step-line">
                            <span className="path-assignment-name">
                              {step.exerciseName}
                            </span>
                            <span className="training-step-metric-pill">
                              {describeExerciseStep(step)}
                            </span>
                          </p>
                          {step.restSec ? (
                            <p className="path-assignment-variant">
                              Pause: <strong>{step.restSec}s</strong>
                            </p>
                          ) : null}
                          <ExerciseVideoPreviewButton
                            exerciseName={step.exerciseName}
                            mediaUrl={step.mediaUrl}
                            compact
                          />
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {assignModal ? (
        <div
          className="path-modal-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.currentTarget === event.target) {
              setAssignModal(null);
            }
          }}
        >
          <section
            className="path-modal training-action-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Training für ${assignModal.dayLabel} hinzufügen`}
          >
            <header className="path-modal-head">
              <div className="path-modal-title-wrap">
                <span className="path-product-chip">Plan zuweisen</span>
                <h3 className="path-modal-title">{assignModal.dayLabel}</h3>
              </div>

              <button
                type="button"
                className="path-modal-close"
                onClick={() => setAssignModal(null)}
                aria-label="Zuweisung schließen"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            {assignModal.currentPlanName ? (
              <p className="training-warning-banner">
                Achtung: Für diesen Tag ist bereits{" "}
                <strong>{assignModal.currentPlanName}</strong> geplant. Beim
                Speichern wird der Plan ersetzt.
              </p>
            ) : null}

            <form
              action={upsertTrainingCalendarEntryAction}
              className="training-action-form"
            >
              <input type="hidden" name="week" value={week} />
              <input
                type="hidden"
                name="dayOfWeek"
                value={assignModal.dayOfWeek}
              />

              <label className="field">
                Trainingsplan
                <select
                  name="trainingPlanId"
                  defaultValue={
                    assignModal.currentPlanId ?? availablePlans[0]?.id ?? ""
                  }
                  required
                >
                  {availablePlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </label>

              <button type="submit">Plan speichern</button>
            </form>
          </section>
        </div>
      ) : null}

      {deleteModal ? (
        <div
          className="path-modal-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.currentTarget === event.target) {
              setDeleteModal(null);
            }
          }}
        >
          <section
            className="path-modal training-action-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Plan für ${deleteModal.dayLabel} löschen`}
          >
            <header className="path-modal-head">
              <div className="path-modal-title-wrap">
                <span className="path-product-chip">Löschen bestätigen</span>
                <h3 className="path-modal-title">{deleteModal.dayLabel}</h3>
              </div>

              <button
                type="button"
                className="path-modal-close"
                onClick={() => setDeleteModal(null)}
                aria-label="Löschen abbrechen"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <p>
              Möchtest du den zugewiesenen Plan{" "}
              <strong>{deleteModal.planName}</strong> wirklich entfernen?
            </p>

            <form
              action={deleteTrainingCalendarEntryAction}
              className="training-delete-form"
            >
              <input type="hidden" name="week" value={week} />
              <input
                type="hidden"
                name="dayOfWeek"
                value={deleteModal.dayOfWeek}
              />

              <button type="submit">Ja, löschen</button>
              <button
                type="button"
                className="training-secondary-button"
                onClick={() => setDeleteModal(null)}
              >
                Abbrechen
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
