"use client";

import {
  createVariantOption,
  createVariantType,
  deleteVariantOption,
  deleteVariantType,
  updateVariantOption,
  updateVariantType,
} from "./actions";
import { useMemo, useState } from "react";

type VariantKind = "TRAINING" | "NUTRITION";
type OptionKind = VariantKind | "INFO";

type VariantItem = {
  id: string;
  name: string;
  internalName: string;
  description: string | null;
  kind: VariantKind;
};

type OptionItem = {
  id: string;
  name: string;
  internalName: string;
  description: string | null;
  kind: OptionKind;
};

type VariantsClientProps = {
  variants: VariantItem[];
  options: OptionItem[];
};

type ViewMode = "variants" | "options";
type ModalMode = "create" | "edit";
type EditorKind = "variant" | "option";

function normalize(input: string) {
  return input.trim().toLowerCase();
}

export function VariantsClient({ variants, options }: VariantsClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("variants");
  const [searchValue, setSearchValue] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<EditorKind>("variant");

  const [editState, setEditState] = useState<
    | { mode: ModalMode; kind: "variant"; entry: VariantItem }
    | { mode: ModalMode; kind: "option"; entry: OptionItem }
    | null
  >(null);

  const search = normalize(searchValue);

  const filteredVariants = useMemo(() => {
    if (!search) {
      return variants;
    }

    return variants.filter((variant) => {
      return `${variant.name} ${variant.internalName} ${variant.description ?? ""} ${variant.kind}`
        .toLowerCase()
        .includes(search);
    });
  }, [search, variants]);

  const filteredOptions = useMemo(() => {
    if (!search) {
      return options;
    }

    return options.filter((option) =>
      `${option.name} ${option.internalName} ${option.description ?? ""} ${option.kind}`
        .toLowerCase()
        .includes(search),
    );
  }, [options, search]);

  const openCreate = () => {
    setCreateKind(viewMode === "variants" ? "variant" : "option");
    setIsCreateOpen(true);
  };

  return (
    <main className="admin-page-stack">
      <header className="admin-page-head">
        <div>
          <h1 className="page-title" style={{ fontSize: "1.7rem" }}>
            Varianten
          </h1>
          <p className="muted">
            Verwalte Varianten (Filter) und Optionen (Gruppierung).
          </p>
        </div>

        <button
          type="button"
          className="admin-plus-button"
          onClick={openCreate}
        >
          + Neu
        </button>
      </header>

      <section className="admin-toolbar">
        <div
          className="admin-view-toggle-row"
          role="tablist"
          aria-label="Varianten Ansicht"
        >
          <span
            aria-hidden="true"
            className={`admin-view-toggle-thumb ${viewMode === "options" ? "is-right" : ""}`}
          />
          <button
            type="button"
            className={`admin-view-toggle ${viewMode === "variants" ? "is-active" : ""}`}
            onClick={() => setViewMode("variants")}
          >
            Varianten
          </button>
          <button
            type="button"
            className={`admin-view-toggle ${viewMode === "options" ? "is-active" : ""}`}
            onClick={() => setViewMode("options")}
          >
            Optionen
          </button>
        </div>

        <label className="field admin-toolbar-search">
          <span>Suche</span>
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Name, intern, Beschreibung…"
          />
        </label>
      </section>

      {viewMode === "variants" ? (
        <section className="admin-list-stack">
          {filteredVariants.length === 0 ? (
            <p className="muted">Keine Varianten gefunden.</p>
          ) : (
            filteredVariants.map((variant) => (
              <article key={variant.id} className="admin-list-card">
                <div className="admin-list-card-head">
                  <div className="admin-list-title-wrap">
                    <h2>{variant.name}</h2>
                    <p className="muted">{variant.internalName}</p>
                  </div>
                  <span className="role-pill">{variant.kind}</span>
                </div>

                {variant.description ? <p>{variant.description}</p> : null}

                <div className="admin-card-actions">
                  <button
                    type="button"
                    className="admin-secondary-button"
                    onClick={() =>
                      setEditState({
                        mode: "edit",
                        kind: "variant",
                        entry: variant,
                      })
                    }
                  >
                    Bearbeiten
                  </button>
                  <form action={deleteVariantType}>
                    <input type="hidden" name="id" value={variant.id} />
                    <button type="submit" className="admin-danger-button">
                      Löschen
                    </button>
                  </form>
                </div>
              </article>
            ))
          )}
        </section>
      ) : (
        <section className="admin-list-stack">
          {filteredOptions.length === 0 ? (
            <p className="muted">Keine Optionen gefunden.</p>
          ) : (
            filteredOptions.map((option) => (
              <article key={option.id} className="admin-list-card">
                <div className="admin-list-card-head">
                  <div className="admin-list-title-wrap">
                    <h2>{option.name}</h2>
                    <p className="muted">{option.internalName}</p>
                  </div>
                  <span className="role-pill">{option.kind}</span>
                </div>

                {option.description ? <p>{option.description}</p> : null}

                <div className="admin-card-actions">
                  <button
                    type="button"
                    className="admin-secondary-button"
                    onClick={() =>
                      setEditState({
                        mode: "edit",
                        kind: "option",
                        entry: option,
                      })
                    }
                  >
                    Bearbeiten
                  </button>
                  <form action={deleteVariantOption}>
                    <input type="hidden" name="id" value={option.id} />
                    <button type="submit" className="admin-danger-button">
                      Löschen
                    </button>
                  </form>
                </div>
              </article>
            ))
          )}
        </section>
      )}

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
              <h2>Neue Variante anlegen</h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setIsCreateOpen(false)}
              >
                ×
              </button>
            </div>

            <div
              className="admin-view-toggle-row"
              role="tablist"
              aria-label="Neuer Varianten-Eintrag"
            >
              <span
                aria-hidden="true"
                className={`admin-view-toggle-thumb ${createKind === "option" ? "is-right" : ""}`}
              />
              <button
                type="button"
                className={`admin-view-toggle ${createKind === "variant" ? "is-active" : ""}`}
                onClick={() => setCreateKind("variant")}
              >
                Variante
              </button>
              <button
                type="button"
                className={`admin-view-toggle ${createKind === "option" ? "is-active" : ""}`}
                onClick={() => setCreateKind("option")}
              >
                Option
              </button>
            </div>

            {createKind === "variant" ? (
              <form
                action={createVariantType}
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
                  <span>Bereich</span>
                  <select name="kind" defaultValue="TRAINING" required>
                    <option value="TRAINING">Training</option>
                    <option value="NUTRITION">Ernährung</option>
                  </select>
                </label>
                <button type="submit">Speichern</button>
              </form>
            ) : (
              <form
                action={createVariantOption}
                className="form-grid"
                onSubmit={() => setIsCreateOpen(false)}
              >
                <label className="field">
                  <span>Bereich</span>
                  <select name="kind" defaultValue="TRAINING" required>
                    <option value="TRAINING">Training</option>
                    <option value="NUTRITION">Ernährung</option>
                    <option value="INFO">Info</option>
                  </select>
                </label>
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
                <button type="submit">Speichern</button>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {editState ? (
        <div
          className="admin-modal-overlay"
          role="presentation"
          onClick={() => setEditState(null)}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-head">
              <h2>
                {editState.kind === "variant"
                  ? "Variante bearbeiten"
                  : "Option bearbeiten"}
              </h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setEditState(null)}
              >
                ×
              </button>
            </div>

            {editState.kind === "variant" ? (
              <form
                action={updateVariantType}
                className="form-grid"
                onSubmit={() => setEditState(null)}
              >
                <input type="hidden" name="id" value={editState.entry.id} />
                <label className="field">
                  <span>Name</span>
                  <input
                    name="name"
                    defaultValue={editState.entry.name}
                    required
                  />
                </label>
                <label className="field">
                  <span>Interner Name</span>
                  <input
                    name="internalName"
                    defaultValue={editState.entry.internalName}
                    required
                  />
                </label>
                <label className="field">
                  <span>Beschreibung</span>
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={editState.entry.description ?? ""}
                  />
                </label>
                <label className="field">
                  <span>Bereich</span>
                  <select
                    name="kind"
                    defaultValue={editState.entry.kind}
                    required
                  >
                    <option value="TRAINING">Training</option>
                    <option value="NUTRITION">Ernährung</option>
                  </select>
                </label>
                <button type="submit">Aktualisieren</button>
              </form>
            ) : (
              <form
                action={updateVariantOption}
                className="form-grid"
                onSubmit={() => setEditState(null)}
              >
                <input type="hidden" name="id" value={editState.entry.id} />
                <label className="field">
                  <span>Bereich</span>
                  <select
                    name="kind"
                    defaultValue={editState.entry.kind}
                    required
                  >
                    <option value="TRAINING">Training</option>
                    <option value="NUTRITION">Ernährung</option>
                    <option value="INFO">Info</option>
                  </select>
                </label>
                <label className="field">
                  <span>Name</span>
                  <input
                    name="name"
                    defaultValue={editState.entry.name}
                    required
                  />
                </label>
                <label className="field">
                  <span>Interner Name</span>
                  <input
                    name="internalName"
                    defaultValue={editState.entry.internalName}
                    required
                  />
                </label>
                <label className="field">
                  <span>Beschreibung</span>
                  <textarea
                    name="description"
                    rows={3}
                    defaultValue={editState.entry.description ?? ""}
                  />
                </label>
                <button type="submit">Aktualisieren</button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}
