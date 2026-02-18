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

type VariantTypeItem = {
  id: string;
  name: string;
  internalName: string;
  description: string | null;
  kind: VariantKind;
  variantOptions: {
    id: string;
    name: string;
    internalName: string;
  }[];
};

type VariantOptionItem = {
  id: string;
  variantTypeId: string;
  name: string;
  internalName: string;
  description: string | null;
  variantType: {
    id: string;
    name: string;
    kind: VariantKind;
  };
};

type VariantsClientProps = {
  types: VariantTypeItem[];
  options: VariantOptionItem[];
};

type ViewMode = "types" | "options";
type ModalMode = "create" | "edit";
type EditorKind = "type" | "option";

function normalize(input: string) {
  return input.trim().toLowerCase();
}

export function VariantsClient({ types, options }: VariantsClientProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("types");
  const [searchValue, setSearchValue] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<EditorKind>("type");

  const [editState, setEditState] = useState<
    | { mode: ModalMode; kind: "type"; entry: VariantTypeItem }
    | { mode: ModalMode; kind: "option"; entry: VariantOptionItem }
    | null
  >(null);

  const search = normalize(searchValue);

  const filteredTypes = useMemo(() => {
    if (!search) {
      return types;
    }

    return types.filter((type) => {
      const optionMatches = type.variantOptions.some((option) =>
        `${option.name} ${option.internalName}`.toLowerCase().includes(search),
      );

      return (
        `${type.name} ${type.internalName} ${type.description ?? ""} ${type.kind}`
          .toLowerCase()
          .includes(search) || optionMatches
      );
    });
  }, [search, types]);

  const filteredOptions = useMemo(() => {
    if (!search) {
      return options;
    }

    return options.filter((option) =>
      `${option.name} ${option.internalName} ${option.description ?? ""} ${option.variantType.name} ${option.variantType.kind}`
        .toLowerCase()
        .includes(search),
    );
  }, [options, search]);

  const openCreate = () => {
    setCreateKind(viewMode === "types" ? "type" : "option");
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
            Verwalte Variantentypen und Variantenoptionen.
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
            className={`admin-view-toggle ${viewMode === "types" ? "is-active" : ""}`}
            onClick={() => setViewMode("types")}
          >
            Typen
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

      {viewMode === "types" ? (
        <section className="admin-list-stack">
          {filteredTypes.length === 0 ? (
            <p className="muted">Keine Variantentypen gefunden.</p>
          ) : (
            filteredTypes.map((type) => (
              <article key={type.id} className="admin-list-card">
                <div className="admin-list-card-head">
                  <div className="admin-list-title-wrap">
                    <h2>{type.name}</h2>
                    <p className="muted">{type.internalName}</p>
                  </div>
                  <span className="role-pill">{type.kind}</span>
                </div>

                {type.description ? <p>{type.description}</p> : null}

                {type.variantOptions.length > 0 ? (
                  <p className="muted">
                    Optionen:{" "}
                    {type.variantOptions
                      .map((option) => option.name)
                      .join(", ")}
                  </p>
                ) : (
                  <p className="muted">Noch keine Optionen.</p>
                )}

                <div className="admin-card-actions">
                  <button
                    type="button"
                    className="admin-secondary-button"
                    onClick={() =>
                      setEditState({ mode: "edit", kind: "type", entry: type })
                    }
                  >
                    Bearbeiten
                  </button>
                  <form action={deleteVariantType}>
                    <input type="hidden" name="id" value={type.id} />
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
            <p className="muted">Keine Variantenoptionen gefunden.</p>
          ) : (
            filteredOptions.map((option) => (
              <article key={option.id} className="admin-list-card">
                <div className="admin-list-card-head">
                  <div className="admin-list-title-wrap">
                    <h2>{option.name}</h2>
                    <p className="muted">{option.internalName}</p>
                  </div>
                  <span className="role-pill">{option.variantType.name}</span>
                </div>

                {option.description ? <p>{option.description}</p> : null}
                <p className="muted">Kategorie: {option.variantType.kind}</p>

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
                className={`admin-view-toggle ${createKind === "type" ? "is-active" : ""}`}
                onClick={() => setCreateKind("type")}
              >
                Typ
              </button>
              <button
                type="button"
                className={`admin-view-toggle ${createKind === "option" ? "is-active" : ""}`}
                onClick={() => setCreateKind("option")}
              >
                Option
              </button>
            </div>

            {createKind === "type" ? (
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
                  <span>Variantentyp</span>
                  <select name="variantTypeId" required>
                    <option value="">Variantentyp wählen</option>
                    {types.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name} ({type.kind})
                      </option>
                    ))}
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
                {editState.kind === "type"
                  ? "Variantentyp bearbeiten"
                  : "Variantenoption bearbeiten"}
              </h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setEditState(null)}
              >
                ×
              </button>
            </div>

            {editState.kind === "type" ? (
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
                  <span>Variantentyp</span>
                  <select
                    name="variantTypeId"
                    defaultValue={editState.entry.variantTypeId}
                    required
                  >
                    {types.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name} ({type.kind})
                      </option>
                    ))}
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
