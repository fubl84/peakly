"use client";

import { ExerciseVideoPreviewButton } from "@/app/dashboard/_components/exercise-video-preview-button";
import { useMemo, useState } from "react";

type ExerciseItem = {
  id: string;
  name: string;
  description: string | null;
  metricType: string;
  mediaUrl: string | null;
};

type ExerciseLibraryClientProps = {
  exercises: ExerciseItem[];
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function ExerciseLibraryClient({ exercises }: ExerciseLibraryClientProps) {
  const [searchValue, setSearchValue] = useState("");

  const search = normalize(searchValue);

  const filteredExercises = useMemo(() => {
    if (!search) {
      return exercises;
    }

    return exercises.filter((exercise) =>
      `${exercise.name} ${exercise.description ?? ""}`.toLowerCase().includes(search),
    );
  }, [exercises, search]);

  return (
    <section className="card stack">
      <h2 className="section-title">Exercise Library</h2>
      <p className="muted">
        Alle Übungen mit schneller Video-Vorschau für Technik-Checks.
      </p>

      <label className="field" style={{ maxWidth: "460px" }}>
        Suche
        <input
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          placeholder="Übungsname oder Beschreibung"
        />
      </label>

      {filteredExercises.length === 0 ? (
        <p className="muted">Keine Übungen gefunden.</p>
      ) : (
        <div className="training-plan-step-list">
          {filteredExercises.map((exercise) => (
            <article key={exercise.id} className="path-assignment-card">
              <p className="training-step-line">
                <span className="path-assignment-name">{exercise.name}</span>
                <span className="training-step-metric-pill">
                  {exercise.metricType === "DURATION" ? "Dauer" : "Wdh."}
                </span>
              </p>
              {exercise.description ? (
                <p className="path-assignment-variant">{exercise.description}</p>
              ) : null}
              <ExerciseVideoPreviewButton
                exerciseName={exercise.name}
                mediaUrl={exercise.mediaUrl}
                compact
              />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
