"use client";

import {
  createPath,
  createPathAssignment,
  deletePath,
  deletePathAssignment,
  updatePath,
} from "./actions";
import { useMemo, useState } from "react";

type AssignmentKind = "TRAINING" | "NUTRITION" | "INFO";

type OptionItem = {
  id: string;
  name: string;
  internalName: string;
};

type PathAssignmentItem = {
  id: string;
  kind: AssignmentKind;
  weekStart: number;
  weekEnd: number;
  contentRefId: string;
  variantOptionId: string | null;
};

type PathItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  assignments: PathAssignmentItem[];
};

type PathsClientProps = {
  paths: PathItem[];
  trainingPlans: OptionItem[];
  nutritionPlans: OptionItem[];
  infoBlocks: OptionItem[];
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function getPathDurationWeeks(assignments: Array<{ weekEnd: number }>) {
  if (assignments.length === 0) {
    return 0;
  }

  return Math.max(...assignments.map((assignment) => assignment.weekEnd));
}

function getKindLabel(kind: AssignmentKind) {
  if (kind === "TRAINING") return "Training";
  if (kind === "NUTRITION") return "Nutrition";
  return "Info";
}

function getKindPillStyle(kind: AssignmentKind) {
  if (kind === "TRAINING") {
    return {
      background: "#e6f6ec",
      color: "#1a7f45",
      border: "1px solid #b9e8ca",
    };
  }

  if (kind === "NUTRITION") {
    return {
      background: "#fff4e7",
      color: "#b15e00",
      border: "1px solid #ffd8ad",
    };
  }

  return {
    background: "#f2ecff",
    color: "#5e33b4",
    border: "1px solid #dccbff",
  };
}

function PathEditorModal({
  path,
  trainingPlans,
  nutritionPlans,
  infoBlocks,
  onClose,
}: {
  path: PathItem;
  trainingPlans: OptionItem[];
  nutritionPlans: OptionItem[];
  infoBlocks: OptionItem[];
  onClose: () => void;
}) {
  const [kind, setKind] = useState<AssignmentKind>("TRAINING");
  const [trainingRefId, setTrainingRefId] = useState(
    trainingPlans[0]?.id ?? "",
  );
  const [nutritionRefId, setNutritionRefId] = useState(
    nutritionPlans[0]?.id ?? "",
  );
  const [infoRefId, setInfoRefId] = useState(infoBlocks[0]?.id ?? "");

  const contentLabelMap = useMemo(() => {
    return {
      TRAINING: new Map(trainingPlans.map((entry) => [entry.id, entry.name])),
      NUTRITION: new Map(nutritionPlans.map((entry) => [entry.id, entry.name])),
      INFO: new Map(infoBlocks.map((entry) => [entry.id, entry.name])),
    };
  }, [trainingPlans, nutritionPlans, infoBlocks]);

  const sortedAssignments = useMemo(
    () =>
      [...path.assignments].sort(
        (left, right) =>
          left.weekStart - right.weekStart ||
          left.kind.localeCompare(right.kind),
      ),
    [path.assignments],
  );

  const weekRows = useMemo(() => {
    const maxWeek = sortedAssignments.reduce(
      (max, assignment) => Math.max(max, assignment.weekEnd),
      0,
    );

    return Array.from({ length: maxWeek }, (_, index) => {
      const week = index + 1;
      const kinds = Array.from(
        new Set(
          sortedAssignments
            .filter(
              (assignment) =>
                assignment.weekStart <= week && assignment.weekEnd >= week,
            )
            .map((assignment) => assignment.kind),
        ),
      ) as AssignmentKind[];

      return { week, kinds };
    });
  }, [sortedAssignments]);

  return (
    <div className="admin-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        style={{ width: "min(980px, 100%)" }}
      >
        <div className="admin-modal-head">
          <div>
            <h2>Path Editor</h2>
            <p className="muted">{path.name}</p>
          </div>
          <button type="button" className="admin-icon-close" onClick={onClose}>
            ×
          </button>
        </div>

        <section className="admin-list-card" style={{ marginBottom: "0.9rem" }}>
          <div className="admin-list-card-head">
            <div className="admin-list-title-wrap">
              <h3>Wochen-Ueberblick</h3>
              <p className="muted">
                Jede Woche zeigt mit Farb-Pills den enthaltenen Content-Typ.
              </p>
            </div>
          </div>

          {weekRows.length === 0 ? (
            <p className="muted">Noch kein Content im Pfad vorhanden.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gap: "0.5rem",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              }}
            >
              {weekRows.map((row) => (
                <article
                  key={row.week}
                  className="admin-list-card"
                  style={{ background: "#fff" }}
                >
                  <p style={{ margin: 0, fontWeight: 600 }}>Woche {row.week}</p>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.35rem",
                      marginTop: "0.35rem",
                    }}
                  >
                    {row.kinds.length === 0 ? (
                      <span className="muted">Leer</span>
                    ) : (
                      row.kinds.map((activeKind) => (
                        <span
                          key={activeKind}
                          style={{
                            ...getKindPillStyle(activeKind),
                            borderRadius: "999px",
                            padding: "0.1rem 0.55rem",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                          }}
                        >
                          {getKindLabel(activeKind)}
                        </span>
                      ))
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="admin-list-card" style={{ marginBottom: "0.9rem" }}>
          <div className="admin-list-card-head">
            <div className="admin-list-title-wrap">
              <h3>Content hinzufuegen</h3>
              <p className="muted">
                Wochenbereich und Variante werden automatisch aus dem gewaehlten
                Inhalt uebernommen.
              </p>
            </div>
          </div>

          <form
            action={createPathAssignment}
            className="form-grid"
            style={{ maxWidth: "100%" }}
          >
            <input type="hidden" name="pathId" value={path.id} />
            <label className="field">
              <span>Typ</span>
              <select
                name="kind"
                value={kind}
                onChange={(event) =>
                  setKind(event.target.value as AssignmentKind)
                }
              >
                <option value="TRAINING">Training</option>
                <option value="NUTRITION">Nutrition</option>
                <option value="INFO">Info</option>
              </select>
            </label>

            {kind === "TRAINING" ? (
              <label className="field">
                <span>Trainingsplan</span>
                <select
                  name="contentRefTrainingId"
                  value={trainingRefId}
                  onChange={(event) => setTrainingRefId(event.target.value)}
                  required
                >
                  {trainingPlans.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} · {entry.internalName}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input type="hidden" name="contentRefTrainingId" value="" />
            )}

            {kind === "NUTRITION" ? (
              <label className="field">
                <span>Ernaehrungsplan</span>
                <select
                  name="contentRefNutritionId"
                  value={nutritionRefId}
                  onChange={(event) => setNutritionRefId(event.target.value)}
                  required
                >
                  {nutritionPlans.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} · {entry.internalName}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input type="hidden" name="contentRefNutritionId" value="" />
            )}

            {kind === "INFO" ? (
              <label className="field">
                <span>Info-Block</span>
                <select
                  name="contentRefInfoId"
                  value={infoRefId}
                  onChange={(event) => setInfoRefId(event.target.value)}
                  required
                >
                  {infoBlocks.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} · {entry.internalName}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input type="hidden" name="contentRefInfoId" value="" />
            )}

            <button type="submit">Zum Pfad hinzufuegen</button>
          </form>
        </section>

        <section className="admin-list-card">
          <div className="admin-list-card-head">
            <div className="admin-list-title-wrap">
              <h3>Aktuelle Zuweisungen</h3>
            </div>
          </div>

          {sortedAssignments.length === 0 ? (
            <p className="muted">Keine Zuweisungen vorhanden.</p>
          ) : (
            <div className="admin-list-stack" style={{ marginTop: "0.3rem" }}>
              {sortedAssignments.map((assignment) => {
                const contentName =
                  contentLabelMap[assignment.kind].get(
                    assignment.contentRefId,
                  ) ?? assignment.contentRefId;

                return (
                  <article
                    key={assignment.id}
                    className="admin-list-card"
                    style={{ background: "#fff" }}
                  >
                    <div className="admin-list-card-head">
                      <div className="admin-list-title-wrap">
                        <p style={{ margin: 0, fontWeight: 600 }}>
                          {contentName}
                        </p>
                        <p className="muted" style={{ margin: 0 }}>
                          W{assignment.weekStart} bis W{assignment.weekEnd}
                        </p>
                      </div>
                      <span
                        style={{
                          ...getKindPillStyle(assignment.kind),
                          borderRadius: "999px",
                          padding: "0.1rem 0.55rem",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                        }}
                      >
                        {getKindLabel(assignment.kind)}
                      </span>
                    </div>
                    <form action={deletePathAssignment}>
                      <input type="hidden" name="id" value={assignment.id} />
                      <button type="submit" className="admin-danger-button">
                        Entfernen
                      </button>
                    </form>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PathFormFields({ path }: { path?: PathItem }) {
  return (
    <>
      {path ? <input type="hidden" name="id" value={path.id} /> : null}
      <label className="field">
        <span>Name</span>
        <input name="name" defaultValue={path?.name ?? ""} required />
      </label>
      <label className="field">
        <span>Beschreibung</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={path?.description ?? ""}
        />
      </label>
      <label className="field">
        <span>Bild-URL</span>
        <input name="imageUrl" defaultValue={path?.imageUrl ?? ""} />
      </label>
    </>
  );
}

export function PathsClient({
  paths,
  trainingPlans,
  nutritionPlans,
  infoBlocks,
}: PathsClientProps) {
  const [searchValue, setSearchValue] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPathId, setEditingPathId] = useState<string | null>(null);
  const [editorPathId, setEditorPathId] = useState<string | null>(null);

  const search = normalize(searchValue);

  const filteredPaths = useMemo(() => {
    if (!search) {
      return paths;
    }

    return paths.filter((path) =>
      `${path.name} ${path.description ?? ""}`.toLowerCase().includes(search),
    );
  }, [paths, search]);

  const editingPath = useMemo(
    () => paths.find((path) => path.id === editingPathId) ?? null,
    [paths, editingPathId],
  );

  const editorPath = useMemo(
    () => paths.find((path) => path.id === editorPathId) ?? null,
    [paths, editorPathId],
  );

  return (
    <main className="admin-page-stack">
      <header className="admin-page-head">
        <div>
          <h1 className="page-title" style={{ fontSize: "1.7rem" }}>
            Pfade
          </h1>
          <p className="muted">Verwalte bestehende Pfade und erstelle neue.</p>
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
            placeholder="Name oder Beschreibung..."
          />
        </label>
      </section>

      <section className="admin-list-stack">
        {filteredPaths.length === 0 ? (
          <p className="muted">Keine Pfade gefunden.</p>
        ) : (
          filteredPaths.map((path) => {
            const durationWeeks = getPathDurationWeeks(path.assignments);

            return (
              <article key={path.id} className="admin-list-card">
                <div className="admin-list-card-head">
                  <div className="admin-list-title-wrap">
                    <h2>{path.name}</h2>
                    <p className="muted">
                      {durationWeeks > 0
                        ? `${durationWeeks} Wochen Gesamtdauer`
                        : "Noch keine Dauer berechenbar"}
                    </p>
                  </div>
                  <span className="role-pill">
                    {path.assignments.length} Zuweisungen
                  </span>
                </div>

                {path.description ? <p>{path.description}</p> : null}
                {path.imageUrl ? (
                  <p className="muted">Bild: {path.imageUrl}</p>
                ) : null}

                <div className="admin-card-actions">
                  <button
                    type="button"
                    className="admin-secondary-button"
                    onClick={() => setEditorPathId(path.id)}
                  >
                    Editor
                  </button>
                  <button
                    type="button"
                    className="admin-secondary-button"
                    onClick={() => setEditingPathId(path.id)}
                  >
                    Bearbeiten
                  </button>
                  <form action={deletePath}>
                    <input type="hidden" name="id" value={path.id} />
                    <button type="submit" className="admin-danger-button">
                      Loeschen
                    </button>
                  </form>
                </div>
              </article>
            );
          })
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
              <h2>Neuer Pfad</h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setIsCreateOpen(false)}
              >
                ×
              </button>
            </div>

            <form
              action={createPath}
              className="form-grid"
              style={{ maxWidth: "100%" }}
              onSubmit={() => setIsCreateOpen(false)}
            >
              <PathFormFields />
              <button type="submit">Speichern</button>
            </form>
          </div>
        </div>
      ) : null}

      {editingPath ? (
        <div
          className="admin-modal-overlay"
          role="presentation"
          onClick={() => setEditingPathId(null)}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-head">
              <h2>Pfad bearbeiten</h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setEditingPathId(null)}
              >
                ×
              </button>
            </div>

            <form
              action={updatePath}
              className="form-grid"
              style={{ maxWidth: "100%" }}
              onSubmit={() => setEditingPathId(null)}
            >
              <PathFormFields path={editingPath} />
              <button type="submit">Aktualisieren</button>
            </form>
          </div>
        </div>
      ) : null}

      {editorPath ? (
        <PathEditorModal
          path={editorPath}
          trainingPlans={trainingPlans}
          nutritionPlans={nutritionPlans}
          infoBlocks={infoBlocks}
          onClose={() => setEditorPathId(null)}
        />
      ) : null}
    </main>
  );
}
