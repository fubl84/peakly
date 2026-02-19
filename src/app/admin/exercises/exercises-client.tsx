"use client";

import { AdminVideoSourceField } from "@/app/admin/_components/admin-video-source-field";
import { createExercise, deleteExercise, updateExercise } from "./actions";
import { useMemo, useState } from "react";

type MetricType = "REPETITIONS" | "DURATION";
type SideMode = "NONE" | "ONE_SIDE" | "BOTH_SIDES";

type OptionItem = {
  id: string;
  name: string;
};

type ExerciseItem = {
  id: string;
  name: string;
  internalName: string;
  description: string | null;
  metricType: MetricType;
  sideMode: SideMode;
  mediaUrl: string | null;
  optionId: string | null;
  option: {
    id: string;
    name: string;
  } | null;
};

type ExercisesClientProps = {
  exercises: ExerciseItem[];
  options: OptionItem[];
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function metricLabel(metricType: MetricType) {
  if (metricType === "DURATION") {
    return "Dauer";
  }

  return "Wiederholungen";
}

function sideModeLabel(sideMode: SideMode) {
  if (sideMode === "ONE_SIDE") {
    return "Einseitig";
  }

  if (sideMode === "BOTH_SIDES") {
    return "Beide Seiten";
  }

  return "Keine Seite";
}

export function ExercisesClient({ exercises, options }: ExercisesClientProps) {
  const [searchValue, setSearchValue] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ExerciseItem | null>(
    null,
  );

  const search = normalize(searchValue);

  const filteredExercises = useMemo(() => {
    if (!search) {
      return exercises;
    }

    return exercises.filter((exercise) =>
      `${exercise.name} ${exercise.internalName} ${exercise.description ?? ""} ${exercise.metricType} ${exercise.sideMode} ${exercise.mediaUrl ?? ""} ${exercise.option?.name ?? ""}`
        .toLowerCase()
        .includes(search),
    );
  }, [exercises, search]);

  return (
    <main className="admin-page-stack">
      <header className="admin-page-head">
        <div>
          <h1 className="page-title" style={{ fontSize: "1.7rem" }}>
            Übungen
          </h1>
          <p className="muted">Verwalte alle Übungen zentral und schnell.</p>
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
            placeholder="Name, intern, Variante, URL…"
          />
        </label>
      </section>

      <section className="admin-list-stack">
        {filteredExercises.length === 0 ? (
          <p className="muted">Keine Übungen gefunden.</p>
        ) : (
          filteredExercises.map((exercise) => (
            <article key={exercise.id} className="admin-list-card">
              <div className="admin-list-card-head">
                <div className="admin-list-title-wrap">
                  <h2>{exercise.name}</h2>
                  <p className="muted">{exercise.internalName}</p>
                </div>
                <span className="role-pill">
                  {metricLabel(exercise.metricType)}
                </span>
              </div>

              {exercise.description ? <p>{exercise.description}</p> : null}

              <p className="muted">
                Seitenmodus: {sideModeLabel(exercise.sideMode)}
              </p>

              <p className="muted">
                Option: {exercise.option?.name ?? "Keine"}
              </p>

              {exercise.mediaUrl ? (
                <a href={exercise.mediaUrl} target="_blank" rel="noreferrer">
                  Medien-Link öffnen
                </a>
              ) : (
                <p className="muted">Kein Medien-Link gesetzt.</p>
              )}

              <div className="admin-card-actions">
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() => setEditingExercise(exercise)}
                >
                  Bearbeiten
                </button>
                <form action={deleteExercise}>
                  <input type="hidden" name="id" value={exercise.id} />
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
              <h2>Neue Übung</h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setIsCreateOpen(false)}
              >
                ×
              </button>
            </div>

            <form
              action={createExercise}
              className="form-grid"
              onSubmit={() => setIsCreateOpen(false)}
            >
              <label className="field">
                <span>Name</span>
                <input name="name" required />
              </label>
              <label className="field">
                <span>Interner Name</span>
                <input name="internalName" required />
              </label>
              <label className="field">
                <span>Beschreibung</span>
                <textarea name="description" rows={3} />
              </label>
              <label className="field">
                <span>Modus</span>
                <select name="metricType" defaultValue="REPETITIONS">
                  <option value="REPETITIONS">Wiederholungen</option>
                  <option value="DURATION">Dauer</option>
                </select>
              </label>
              <label className="field">
                <span>Seitenmodus</span>
                <select name="sideMode" defaultValue="NONE">
                  <option value="NONE">Keine Seite</option>
                  <option value="ONE_SIDE">Einseitig</option>
                  <option value="BOTH_SIDES">Beide Seiten</option>
                </select>
              </label>
              <AdminVideoSourceField
                fieldName="mediaUrl"
                label="Videoquelle"
                youtubePlaceholder="Video/YouTube URL (optional)"
              />
              <label className="field">
                <span>Option</span>
                <select name="optionId" defaultValue="">
                  <option value="">Keine Option</option>
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>

              <button type="submit">Speichern</button>
            </form>
          </div>
        </div>
      ) : null}

      {editingExercise ? (
        <div
          className="admin-modal-overlay"
          role="presentation"
          onClick={() => setEditingExercise(null)}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-head">
              <h2>Übung bearbeiten</h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setEditingExercise(null)}
              >
                ×
              </button>
            </div>

            <form
              action={updateExercise}
              className="form-grid"
              onSubmit={() => setEditingExercise(null)}
            >
              <input type="hidden" name="id" value={editingExercise.id} />
              <label className="field">
                <span>Name</span>
                <input
                  name="name"
                  defaultValue={editingExercise.name}
                  required
                />
              </label>
              <label className="field">
                <span>Interner Name</span>
                <input
                  name="internalName"
                  defaultValue={editingExercise.internalName}
                  required
                />
              </label>
              <label className="field">
                <span>Beschreibung</span>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={editingExercise.description ?? ""}
                />
              </label>
              <label className="field">
                <span>Modus</span>
                <select
                  name="metricType"
                  defaultValue={editingExercise.metricType}
                >
                  <option value="REPETITIONS">Wiederholungen</option>
                  <option value="DURATION">Dauer</option>
                </select>
              </label>
              <label className="field">
                <span>Seitenmodus</span>
                <select name="sideMode" defaultValue={editingExercise.sideMode}>
                  <option value="NONE">Keine Seite</option>
                  <option value="ONE_SIDE">Einseitig</option>
                  <option value="BOTH_SIDES">Beide Seiten</option>
                </select>
              </label>
              <AdminVideoSourceField
                fieldName="mediaUrl"
                label="Videoquelle"
                defaultValue={editingExercise.mediaUrl}
                youtubePlaceholder="Video/YouTube URL (optional)"
              />
              <label className="field">
                <span>Option</span>
                <select
                  name="optionId"
                  defaultValue={editingExercise.optionId ?? ""}
                >
                  <option value="">Keine Option</option>
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>

              <button type="submit">Aktualisieren</button>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
