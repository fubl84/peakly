"use client";

import { ArrowLeft, ArrowRight, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type CatalogAssignment = {
  id: string;
  kind: "TRAINING" | "NUTRITION" | "INFO";
  weekStart: number;
  weekEnd: number;
  contentName: string;
  variantName: string | null;
};

type CatalogPath = {
  id: string;
  name: string;
  maxWeek: number;
  trainingCount: number;
  nutritionCount: number;
  infoCount: number;
  assignments: CatalogAssignment[];
};

type PathsCatalogClientProps = {
  paths: CatalogPath[];
};

const KIND_LABEL: Record<CatalogAssignment["kind"], string> = {
  TRAINING: "Training",
  NUTRITION: "Ernährung",
  INFO: "Info",
};

const KIND_CLASS: Record<CatalogAssignment["kind"], string> = {
  TRAINING: "is-training",
  NUTRITION: "is-nutrition",
  INFO: "is-info",
};

function clampWeek(week: number, maxWeek: number) {
  if (week < 1) return 1;
  if (week > maxWeek) return maxWeek;
  return week;
}

export function PathsCatalogClient({ paths }: PathsCatalogClientProps) {
  const [activePathId, setActivePathId] = useState<string | null>(null);
  const [activeWeek, setActiveWeek] = useState(1);

  const activePath = useMemo(
    () => paths.find((path) => path.id === activePathId) ?? null,
    [activePathId, paths],
  );

  const isModalOpen = activePath !== null;

  const visibleAssignments = useMemo(() => {
    if (!activePath) {
      return [] as CatalogAssignment[];
    }

    return activePath.assignments.filter(
      (assignment) =>
        assignment.weekStart <= activeWeek && assignment.weekEnd >= activeWeek,
    );
  }, [activePath, activeWeek]);

  const assignmentsByKind = useMemo(
    () => ({
      TRAINING: visibleAssignments.filter((entry) => entry.kind === "TRAINING"),
      NUTRITION: visibleAssignments.filter(
        (entry) => entry.kind === "NUTRITION",
      ),
      INFO: visibleAssignments.filter((entry) => entry.kind === "INFO"),
    }),
    [visibleAssignments],
  );

  useEffect(() => {
    if (!isModalOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActivePathId(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isModalOpen]);

  function openPathModal(path: CatalogPath) {
    setActivePathId(path.id);
    setActiveWeek(1);
  }

  function closePathModal() {
    setActivePathId(null);
  }

  function moveWeek(offset: number) {
    if (!activePath) {
      return;
    }

    setActiveWeek((previousWeek) =>
      clampWeek(previousWeek + offset, activePath.maxWeek),
    );
  }

  function resetToFirstWeek() {
    setActiveWeek(1);
  }

  return (
    <>
      <section className="path-card-grid" aria-label="Verfügbare Pfade">
        {paths.map((path) => (
          <button
            type="button"
            key={path.id}
            className="path-product-card"
            onClick={() => openPathModal(path)}
          >
            <div className="path-product-card-head">
              <span className="path-product-chip">Pfad</span>
              <span className="path-product-meta">{path.maxWeek} Wochen</span>
            </div>
            <h2 className="path-product-title">{path.name}</h2>

            <div className="path-product-stats">
              <span>{path.trainingCount}× Training</span>
              <span>{path.nutritionCount}× Ernährung</span>
              <span>{path.infoCount}× Info</span>
            </div>

            <span className="path-product-cta">
              Pfad ansehen <ChevronRight size={14} aria-hidden="true" />
            </span>
          </button>
        ))}
      </section>

      {activePath ? (
        <div
          className="path-modal-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closePathModal();
            }
          }}
        >
          <section
            className="path-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Pfaddetails ${activePath.name}`}
          >
            <header className="path-modal-head">
              <div className="path-modal-title-wrap">
                <span className="path-product-chip">Pfadvorschau</span>
                <h3 className="path-modal-title">{activePath.name}</h3>
                <p className="muted">
                  Inhalte und Zuordnungen für die gewählte Woche.
                </p>
              </div>

              <button
                type="button"
                className="path-modal-close"
                onClick={closePathModal}
                aria-label="Pfadvorschau schließen"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <section className="week-head path-week-head">
              <div className="week-head-meta">
                <span>
                  Woche <strong>{activeWeek}</strong> von {activePath.maxWeek}
                </span>
                <span>{visibleAssignments.length} Inhalte in dieser Woche</span>
              </div>

              <div className="week-nav">
                <button
                  type="button"
                  className="week-nav-button"
                  onClick={() => moveWeek(-1)}
                  disabled={activeWeek <= 1}
                >
                  <ArrowLeft size={14} aria-hidden="true" /> Vorherige Woche
                </button>
                <button
                  type="button"
                  className="week-nav-button"
                  onClick={resetToFirstWeek}
                  disabled={activeWeek === 1}
                >
                  Zur ersten Woche
                </button>
                <button
                  type="button"
                  className="week-nav-button"
                  onClick={() => moveWeek(1)}
                  disabled={activeWeek >= activePath.maxWeek}
                >
                  Nächste Woche <ArrowRight size={14} aria-hidden="true" />
                </button>
              </div>
            </section>

            {visibleAssignments.length === 0 ? (
              <p className="path-modal-empty">
                Für diese Woche sind keine Inhalte hinterlegt.
              </p>
            ) : (
              <div className="path-assignment-columns">
                {(
                  Object.keys(assignmentsByKind) as CatalogAssignment["kind"][]
                ).map((kind) => {
                  const entries = assignmentsByKind[kind];
                  if (entries.length === 0) {
                    return null;
                  }

                  return (
                    <section key={kind} className="path-assignment-group">
                      <h4>{KIND_LABEL[kind]}</h4>
                      <div className="path-assignment-list">
                        {entries.map((entry) => (
                          <article
                            key={entry.id}
                            className="path-assignment-card"
                          >
                            <div className="path-assignment-top">
                              <span
                                className={`path-kind-pill ${KIND_CLASS[entry.kind]}`}
                              >
                                {KIND_LABEL[entry.kind]}
                              </span>
                              <span className="path-assignment-week-range">
                                W{entry.weekStart} - W{entry.weekEnd}
                              </span>
                            </div>
                            <p className="path-assignment-name">
                              {entry.contentName}
                            </p>
                            {entry.variantName ? (
                              <p className="path-assignment-variant">
                                Variante: <strong>{entry.variantName}</strong>
                              </p>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
