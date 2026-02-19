"use client";

import { AdminVideoSourceField } from "@/app/admin/_components/admin-video-source-field";
import {
  createTrainingPlan,
  createTrainingPlanExercise,
  deleteTrainingPlanExercise,
  deleteTrainingPlan,
  duplicateTrainingSet,
  reorderTrainingPlanExercises,
  updateTrainingPlan,
} from "./actions";
import { useMemo, useState, useTransition } from "react";

type VariantOptionItem = {
  id: string;
  name: string;
};

type TrainingPlanItem = {
  id: string;
  name: string;
  internalName: string;
  description: string | null;
  videoUrl: string | null;
  weekStart: number;
  weekEnd: number;
  variantOptionId: string | null;
  variantOption: {
    id: string;
    name: string;
  } | null;
  trainingExercises: {
    id: string;
    block: string;
    position: number;
    reps: number | null;
    durationSec: number | null;
    restSec: number | null;
    info: string | null;
    exercise: {
      id: string;
      name: string;
      metricType: "REPETITIONS" | "DURATION";
    };
  }[];
};

type ExerciseItem = {
  id: string;
  name: string;
  metricType: "REPETITIONS" | "DURATION";
};

type TrainingPlansClientProps = {
  plans: TrainingPlanItem[];
  variantOptions: VariantOptionItem[];
  exercises: ExerciseItem[];
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function parseSetIndex(block: string) {
  const match = /^SET-(\d+)$/.exec(block);
  return match ? Number(match[1]) : null;
}

function compareBlocks(left: string, right: string) {
  if (left === right) return 0;
  if (left === "WARMUP") return -1;
  if (right === "WARMUP") return 1;
  if (left === "COOLDOWN") return 1;
  if (right === "COOLDOWN") return -1;

  const leftSet = parseSetIndex(left);
  const rightSet = parseSetIndex(right);
  if (leftSet !== null && rightSet !== null) {
    return leftSet - rightSet;
  }

  if (leftSet !== null) return -1;
  if (rightSet !== null) return 1;
  return left.localeCompare(right);
}

function formatBlockLabel(block: string) {
  if (block === "WARMUP") return "Warm-up";
  if (block === "COOLDOWN") return "Cooldown";

  const setIndex = parseSetIndex(block);
  return setIndex !== null ? `Set ${setIndex}` : block;
}

function getMetricLabel(entry: TrainingPlanItem["trainingExercises"][number]) {
  if (entry.exercise.metricType === "REPETITIONS") {
    return `${entry.reps ?? "-"} Wdh.`;
  }

  return `${entry.durationSec ?? "-"} Sek.`;
}

function buildOrderedBlocks(
  plan: TrainingPlanItem,
  draftBlocks: string[],
  includeFallback = true,
) {
  const merged = new Set<string>([
    ...plan.trainingExercises.map((entry) => entry.block),
    ...draftBlocks,
  ]);

  if (includeFallback && merged.size === 0) {
    merged.add("WARMUP");
  }

  return Array.from(merged).sort(compareBlocks);
}

function getNextSetBlock(blocks: string[]) {
  const setIndexes = blocks
    .map(parseSetIndex)
    .filter((value): value is number => value !== null);

  return `SET-${setIndexes.length === 0 ? 1 : Math.max(...setIndexes) + 1}`;
}

function TrainingPlanEditorModal({
  plan,
  exercises,
  onClose,
}: {
  plan: TrainingPlanItem;
  exercises: ExerciseItem[];
  onClose: () => void;
}) {
  const [draftBlocks, setDraftBlocks] = useState<string[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<string>("");
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>(
    exercises[0]?.id ?? "",
  );
  const [dragging, setDragging] = useState<{
    id: string;
    block: string;
  } | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [isReorderPending, startReorderTransition] = useTransition();

  const orderedBlocks = useMemo(
    () => buildOrderedBlocks(plan, draftBlocks),
    [draftBlocks, plan],
  );

  const activeBlock =
    selectedBlock && orderedBlocks.includes(selectedBlock)
      ? selectedBlock
      : (orderedBlocks[0] ?? "");

  const activeExerciseId =
    selectedExerciseId &&
    exercises.some((exercise) => exercise.id === selectedExerciseId)
      ? selectedExerciseId
      : (exercises[0]?.id ?? "");

  const selectedExercise = useMemo(
    () =>
      exercises.find((exercise) => exercise.id === activeExerciseId) ?? null,
    [activeExerciseId, exercises],
  );

  const selectedBlockEntries = useMemo(
    () =>
      plan.trainingExercises
        .filter((entry) => entry.block === activeBlock)
        .sort((left, right) => left.position - right.position),
    [activeBlock, plan.trainingExercises],
  );

  const nextPosition = selectedBlockEntries.length + 1;
  const selectedBlockKind =
    activeBlock === "WARMUP"
      ? "WARMUP"
      : activeBlock === "COOLDOWN"
        ? "COOLDOWN"
        : "TRAINING_SET";

  function addWarmupBlock() {
    setDraftBlocks((current) =>
      current.includes("WARMUP") || orderedBlocks.includes("WARMUP")
        ? current
        : [...current, "WARMUP"],
    );
    setSelectedBlock("WARMUP");
  }

  function addCooldownBlock() {
    setDraftBlocks((current) =>
      current.includes("COOLDOWN") || orderedBlocks.includes("COOLDOWN")
        ? current
        : [...current, "COOLDOWN"],
    );
    setSelectedBlock("COOLDOWN");
  }

  function addSetBlock() {
    const nextSet = getNextSetBlock(
      buildOrderedBlocks(plan, draftBlocks, false),
    );
    setDraftBlocks((current) =>
      current.includes(nextSet) || orderedBlocks.includes(nextSet)
        ? current
        : [...current, nextSet],
    );
    setSelectedBlock(nextSet);
  }

  function handleDrop(block: string, targetId: string | null) {
    if (!dragging || dragging.block !== block) {
      return;
    }

    const entries = plan.trainingExercises
      .filter((entry) => entry.block === block)
      .sort((left, right) => left.position - right.position);
    const currentIndex = entries.findIndex((entry) => entry.id === dragging.id);

    if (currentIndex < 0) {
      setDragging(null);
      return;
    }

    const orderedIds = entries.map((entry) => entry.id);
    const [movedId] = orderedIds.splice(currentIndex, 1);

    if (!targetId) {
      orderedIds.push(movedId);
    } else {
      const targetIndex = orderedIds.findIndex((id) => id === targetId);
      orderedIds.splice(
        targetIndex < 0 ? orderedIds.length : targetIndex,
        0,
        movedId,
      );
    }

    setDragging(null);
    setReorderError(null);

    const formData = new FormData();
    formData.set("trainingPlanId", plan.id);
    formData.set("block", block);
    formData.set("orderedExerciseIds", JSON.stringify(orderedIds));

    startReorderTransition(() => {
      reorderTrainingPlanExercises(formData).catch((error: unknown) => {
        setReorderError(
          error instanceof Error
            ? error.message
            : "Reihenfolge konnte nicht gespeichert werden.",
        );
      });
    });
  }

  return (
    <div className="admin-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        style={{ width: "min(960px, 100%)" }}
      >
        <div className="admin-modal-head">
          <div>
            <h2>Trainingsplan Editor</h2>
            <p className="muted">
              {plan.name} · {plan.internalName}
            </p>
          </div>
          <button type="button" className="admin-icon-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="admin-list-stack" style={{ marginTop: "0.5rem" }}>
          <section className="admin-list-card">
            <div
              className="admin-card-actions"
              style={{ justifyContent: "flex-start" }}
            >
              <button
                type="button"
                className="admin-secondary-button"
                onClick={addWarmupBlock}
              >
                + Warm-up
              </button>
              <button
                type="button"
                className="admin-secondary-button"
                onClick={addSetBlock}
              >
                + Set
              </button>
              <button
                type="button"
                className="admin-secondary-button"
                onClick={addCooldownBlock}
              >
                + Cooldown
              </button>
            </div>

            <label className="field" style={{ maxWidth: "360px" }}>
              <span>Aktiver Block</span>
              <select
                value={activeBlock}
                onChange={(event) => setSelectedBlock(event.target.value)}
                disabled={orderedBlocks.length === 0}
              >
                {orderedBlocks.map((block) => (
                  <option key={block} value={block}>
                    {formatBlockLabel(block)}
                  </option>
                ))}
              </select>
            </label>

            <form
              action={createTrainingPlanExercise}
              className="form-grid"
              style={{ maxWidth: "100%" }}
            >
              <input type="hidden" name="trainingPlanId" value={plan.id} />
              <input type="hidden" name="block" value={activeBlock} />
              <input type="hidden" name="blockKind" value={selectedBlockKind} />
              <input
                type="hidden"
                name="position"
                value={String(nextPosition)}
              />

              <label className="field">
                <span>Übung</span>
                <select
                  name="exerciseId"
                  value={activeExerciseId}
                  onChange={(event) =>
                    setSelectedExerciseId(event.target.value)
                  }
                  required
                  disabled={
                    orderedBlocks.length === 0 || exercises.length === 0
                  }
                >
                  {exercises.map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.name}
                    </option>
                  ))}
                </select>
              </label>

              <div
                style={{
                  display: "grid",
                  gap: "0.5rem",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                }}
              >
                <label className="field">
                  <span>Wiederholungen</span>
                  <input
                    name="reps"
                    type="number"
                    min={1}
                    required={selectedExercise?.metricType === "REPETITIONS"}
                  />
                </label>
                <label className="field">
                  <span>Dauer (Sek.)</span>
                  <input
                    name="durationSec"
                    type="number"
                    min={1}
                    required={selectedExercise?.metricType === "DURATION"}
                  />
                </label>
                <label className="field">
                  <span>Pause (Sek.)</span>
                  <input name="restSec" type="number" min={0} />
                </label>
              </div>

              <label className="field">
                <span>Hinweis</span>
                <input name="info" placeholder="Optionaler Hinweis" />
              </label>

              <button
                type="submit"
                disabled={orderedBlocks.length === 0 || exercises.length === 0}
              >
                Zu Block hinzufügen
              </button>
            </form>
          </section>

          {reorderError ? (
            <p className="training-warning-banner">{reorderError}</p>
          ) : null}

          {orderedBlocks.map((block) => {
            const blockEntries = plan.trainingExercises
              .filter((entry) => entry.block === block)
              .sort((left, right) => left.position - right.position);

            return (
              <section key={block} className="admin-list-card">
                <div className="admin-list-card-head">
                  <div className="admin-list-title-wrap">
                    <h2>{formatBlockLabel(block)}</h2>
                    <p className="muted">
                      Reihenfolge per Drag-and-drop aendern
                      {isReorderPending ? " · Speichert..." : ""}
                    </p>
                  </div>
                  <div
                    className="admin-card-actions"
                    style={{ alignItems: "center" }}
                  >
                    {parseSetIndex(block) !== null ? (
                      <form action={duplicateTrainingSet}>
                        <input
                          type="hidden"
                          name="trainingPlanId"
                          value={plan.id}
                        />
                        <input type="hidden" name="sourceBlock" value={block} />
                        <button
                          type="submit"
                          className="admin-secondary-button"
                          title="Set duplizieren"
                          aria-label="Set duplizieren"
                          style={{
                            minWidth: "2rem",
                            minHeight: "2rem",
                            padding: "0.2rem 0.45rem",
                            lineHeight: 1,
                          }}
                        >
                          ⧉
                        </button>
                      </form>
                    ) : null}
                    <span className="role-pill">
                      {blockEntries.length} Uebungen
                    </span>
                  </div>
                </div>

                {blockEntries.length === 0 ? (
                  <p className="muted">Noch keine Uebungen in diesem Block.</p>
                ) : (
                  <div
                    className="admin-list-stack"
                    style={{ marginTop: "0.25rem" }}
                  >
                    {blockEntries.map((entry) => (
                      <article
                        key={entry.id}
                        className="admin-list-card"
                        draggable
                        onDragStart={() => setDragging({ id: entry.id, block })}
                        onDragEnd={() => setDragging(null)}
                        onDragOver={(event) => {
                          if (dragging?.block === block) {
                            event.preventDefault();
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          handleDrop(block, entry.id);
                        }}
                        style={{ cursor: "grab", background: "#fff" }}
                      >
                        <div className="admin-list-card-head">
                          <div className="admin-list-title-wrap">
                            <h3 style={{ margin: 0 }}>{entry.exercise.name}</h3>
                            <p className="muted">
                              Pos. {entry.position} · {getMetricLabel(entry)}
                              {entry.restSec !== null
                                ? ` · Pause ${entry.restSec} Sek.`
                                : ""}
                            </p>
                          </div>
                          <form action={deleteTrainingPlanExercise}>
                            <input type="hidden" name="id" value={entry.id} />
                            <button
                              type="submit"
                              className="admin-danger-button"
                            >
                              Entfernen
                            </button>
                          </form>
                        </div>
                        {entry.info ? (
                          <p className="muted">{entry.info}</p>
                        ) : null}
                      </article>
                    ))}

                    <div
                      onDragOver={(event) => {
                        if (dragging?.block === block) {
                          event.preventDefault();
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleDrop(block, null);
                      }}
                      className="muted"
                      style={{
                        border: "1px dashed var(--border)",
                        borderRadius: "10px",
                        padding: "0.5rem 0.65rem",
                        textAlign: "center",
                        background: "#faf8ff",
                      }}
                    >
                      Hierher ziehen, um ans Ende zu verschieben
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TrainingPlanFormFields({
  variantOptions,
  plan,
}: {
  variantOptions: VariantOptionItem[];
  plan?: TrainingPlanItem;
}) {
  return (
    <>
      {plan ? <input type="hidden" name="id" value={plan.id} /> : null}
      <label className="field">
        <span>Name</span>
        <input name="name" defaultValue={plan?.name ?? ""} required />
      </label>
      <label className="field">
        <span>Interner Name</span>
        <input
          name="internalName"
          defaultValue={plan?.internalName ?? ""}
          required
        />
      </label>
      <label className="field">
        <span>Beschreibung</span>
        <textarea
          name="description"
          rows={2}
          defaultValue={plan?.description ?? ""}
        />
      </label>
      <AdminVideoSourceField
        fieldName="videoUrl"
        label="Plan-Video"
        defaultValue={plan?.videoUrl}
        youtubePlaceholder="z.B. YouTube-Link für kompletten Plan"
      />
      <div
        style={{
          display: "grid",
          gap: "0.5rem",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        }}
      >
        <label className="field">
          <span>Woche von</span>
          <input
            name="weekStart"
            type="number"
            min={1}
            defaultValue={plan?.weekStart ?? 1}
            required
          />
        </label>
        <label className="field">
          <span>Woche bis</span>
          <input
            name="weekEnd"
            type="number"
            min={1}
            defaultValue={plan?.weekEnd ?? 1}
            required
          />
        </label>
      </div>
      <label className="field">
        <span>Trainingsvariante</span>
        <select
          name="variantOptionId"
          defaultValue={plan?.variantOptionId ?? ""}
        >
          <option value="">Keine Trainingsvariante</option>
          {variantOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

export function TrainingPlansClient({
  plans,
  variantOptions,
  exercises,
}: TrainingPlansClientProps) {
  const [searchValue, setSearchValue] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<TrainingPlanItem | null>(null);
  const [editorPlanId, setEditorPlanId] = useState<string | null>(null);

  const search = normalize(searchValue);

  const filteredPlans = useMemo(() => {
    if (!search) {
      return plans;
    }

    return plans.filter((plan) =>
      `${plan.name} ${plan.internalName} ${plan.description ?? ""} ${plan.videoUrl ?? ""} ${plan.variantOption?.name ?? ""}`
        .toLowerCase()
        .includes(search),
    );
  }, [plans, search]);

  const editorPlan = useMemo(
    () => plans.find((plan) => plan.id === editorPlanId) ?? null,
    [editorPlanId, plans],
  );

  return (
    <main className="admin-page-stack">
      <header className="admin-page-head">
        <div>
          <h1 className="page-title" style={{ fontSize: "1.7rem" }}>
            Trainingspläne
          </h1>
          <p className="muted">
            Verwalte Trainingspläne und deren Zeitfenster.
          </p>
        </div>

        <button
          type="button"
          className="admin-plus-button"
          onClick={() => setIsCreateOpen(true)}
        >
          + Neu
        </button>
      </header>

      <section className="admin-toolbar">
        <label className="field admin-toolbar-search">
          <span>Suche</span>
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Name, intern, Beschreibung…"
          />
        </label>
      </section>

      <section className="admin-list-stack">
        {filteredPlans.length === 0 ? (
          <p className="muted">Keine Trainingspläne gefunden.</p>
        ) : (
          filteredPlans.map((plan) => (
            <article key={plan.id} className="admin-list-card">
              <div className="admin-list-card-head">
                <div className="admin-list-title-wrap">
                  <h2>{plan.name}</h2>
                  <p className="muted">{plan.internalName}</p>
                </div>
                <span className="role-pill">
                  W{plan.weekStart}-W{plan.weekEnd}
                </span>
              </div>

              {plan.description ? <p>{plan.description}</p> : null}

              {plan.videoUrl ? (
                <a href={plan.videoUrl} target="_blank" rel="noreferrer">
                  Plan-Video öffnen
                </a>
              ) : null}

              <p className="muted">
                Variante: {plan.variantOption?.name ?? "Keine"} · Übungen im
                Plan: {plan.trainingExercises.length}
              </p>

              <div className="admin-card-actions">
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() => setEditorPlanId(plan.id)}
                >
                  Editor
                </button>
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() => setEditingPlan(plan)}
                >
                  Bearbeiten
                </button>
                <form action={deleteTrainingPlan}>
                  <input type="hidden" name="id" value={plan.id} />
                  <button type="submit" className="admin-danger-button">
                    Löschen
                  </button>
                </form>
              </div>
            </article>
          ))
        )}
      </section>

      {isCreateOpen ? (
        <div
          className="admin-modal-overlay"
          role="presentation"
          onClick={() => setIsCreateOpen(false)}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-head">
              <h2>Neuer Trainingsplan</h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setIsCreateOpen(false)}
              >
                ×
              </button>
            </div>

            <form
              action={createTrainingPlan}
              className="form-grid"
              onSubmit={() => setIsCreateOpen(false)}
              style={{ maxWidth: "100%" }}
            >
              <TrainingPlanFormFields variantOptions={variantOptions} />
              <button type="submit">Speichern</button>
            </form>
          </div>
        </div>
      ) : null}

      {editingPlan ? (
        <div
          className="admin-modal-overlay"
          role="presentation"
          onClick={() => setEditingPlan(null)}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-head">
              <h2>Trainingsplan bearbeiten</h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setEditingPlan(null)}
              >
                ×
              </button>
            </div>

            <form
              action={updateTrainingPlan}
              className="form-grid"
              onSubmit={() => setEditingPlan(null)}
              style={{ maxWidth: "100%" }}
            >
              <TrainingPlanFormFields
                variantOptions={variantOptions}
                plan={editingPlan}
              />
              <button type="submit">Aktualisieren</button>
            </form>
          </div>
        </div>
      ) : null}

      {editorPlan ? (
        <TrainingPlanEditorModal
          plan={editorPlan}
          exercises={exercises}
          onClose={() => setEditorPlanId(null)}
        />
      ) : null}
    </main>
  );
}
