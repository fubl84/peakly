"use client";

import { AdminVideoSourceField } from "@/app/admin/_components/admin-video-source-field";
import { createInfoBlock, deleteInfoBlock, updateInfoBlock } from "./actions";
import { useMemo, useState } from "react";

type InfoCategory = "FOOD" | "WORKOUT" | "MOTIVATION" | "GENERAL";

type InfoBlockItem = {
  id: string;
  name: string;
  internalName: string;
  contentHtml: string;
  videoUrl: string | null;
  isFullPath: boolean;
  weekStart: number | null;
  weekEnd: number | null;
  category: InfoCategory;
};

type InfoBlocksClientProps = {
  infoBlocks: InfoBlockItem[];
};

const CATEGORIES: Array<{ value: InfoCategory; label: string }> = [
  { value: "FOOD", label: "Food" },
  { value: "WORKOUT", label: "Workout" },
  { value: "MOTIVATION", label: "Motivation" },
  { value: "GENERAL", label: "General" },
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function InfoBlockFormFields({ block }: { block?: InfoBlockItem }) {
  const [scope, setScope] = useState<"WEEK_BASED" | "FULL_PATH">(
    block?.isFullPath ? "FULL_PATH" : "WEEK_BASED",
  );

  return (
    <>
      {block ? <input type="hidden" name="id" value={block.id} /> : null}
      <label className="field">
        <span>Name</span>
        <input name="name" defaultValue={block?.name ?? ""} required />
      </label>
      <label className="field">
        <span>Interner Name</span>
        <input
          name="internalName"
          defaultValue={block?.internalName ?? ""}
          required
        />
      </label>
      <label className="field">
        <span>Inhalt (Markdown)</span>
        <textarea
          name="contentMarkdown"
          rows={8}
          defaultValue={block?.contentHtml ?? ""}
          required
        />
      </label>
      <AdminVideoSourceField
        fieldName="videoUrl"
        label="Videoquelle"
        defaultValue={block?.videoUrl}
        youtubePlaceholder="https://..."
      />
      <label className="field">
        <span>Kategorie</span>
        <select name="category" defaultValue={block?.category ?? "GENERAL"}>
          {CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Scope</span>
        <select
          name="scope"
          value={scope}
          onChange={(event) =>
            setScope(event.target.value as "WEEK_BASED" | "FULL_PATH")
          }
        >
          <option value="WEEK_BASED">Wochenbasiert</option>
          <option value="FULL_PATH">Gesamter Pfad</option>
        </select>
      </label>

      {scope === "WEEK_BASED" ? (
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
              defaultValue={block?.weekStart ?? 1}
              required
            />
          </label>
          <label className="field">
            <span>Woche bis</span>
            <input
              name="weekEnd"
              type="number"
              min={1}
              defaultValue={block?.weekEnd ?? 1}
              required
            />
          </label>
        </div>
      ) : null}
    </>
  );
}

export function InfoBlocksClient({ infoBlocks }: InfoBlocksClientProps) {
  const [searchValue, setSearchValue] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<InfoBlockItem | null>(null);

  const search = normalize(searchValue);

  const filteredBlocks = useMemo(() => {
    if (!search) {
      return infoBlocks;
    }

    return infoBlocks.filter((block) =>
      `${block.name} ${block.internalName} ${block.category} ${block.contentHtml} ${block.videoUrl ?? ""}`
        .toLowerCase()
        .includes(search),
    );
  }, [infoBlocks, search]);

  return (
    <main className="admin-page-stack">
      <header className="admin-page-head">
        <div>
          <h1 className="page-title" style={{ fontSize: "1.7rem" }}>
            Info-Bloecke
          </h1>
          <p className="muted">
            Verwalte Info-Bloecke mit Markdown-Inhalt fuer die Pfade.
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
            placeholder="Name, intern, Kategorie..."
          />
        </label>
      </section>

      <section className="admin-list-stack">
        {filteredBlocks.length === 0 ? (
          <p className="muted">Keine Info-Bloecke gefunden.</p>
        ) : (
          filteredBlocks.map((block) => (
            <article key={block.id} className="admin-list-card">
              <div className="admin-list-card-head">
                <div className="admin-list-title-wrap">
                  <h2>{block.name}</h2>
                  <p className="muted">{block.internalName}</p>
                </div>
                <span className="role-pill">{block.category}</span>
              </div>

              <p className="muted">
                Scope: {block.isFullPath ? "Gesamter Pfad" : "Wochenbasiert"}
                {block.isFullPath
                  ? ""
                  : ` · W${block.weekStart ?? "-"}-W${block.weekEnd ?? "-"}`}
              </p>

              <p className="muted">
                Video: {block.videoUrl ? "Vorhanden" : "Kein Video"}
              </p>

              <p
                className="muted"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {block.contentHtml}
              </p>

              <div className="admin-card-actions">
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() => setEditingBlock(block)}
                >
                  Bearbeiten
                </button>
                <form action={deleteInfoBlock}>
                  <input type="hidden" name="id" value={block.id} />
                  <button type="submit" className="admin-danger-button">
                    Loeschen
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
              <h2>Neuer Info-Block</h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setIsCreateOpen(false)}
              >
                ×
              </button>
            </div>

            <form
              action={createInfoBlock}
              className="form-grid"
              style={{ maxWidth: "100%" }}
              onSubmit={() => setIsCreateOpen(false)}
            >
              <InfoBlockFormFields />
              <button type="submit">Speichern</button>
            </form>
          </div>
        </div>
      ) : null}

      {editingBlock ? (
        <div
          className="admin-modal-overlay"
          role="presentation"
          onClick={() => setEditingBlock(null)}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-head">
              <h2>Info-Block bearbeiten</h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setEditingBlock(null)}
              >
                ×
              </button>
            </div>

            <form
              action={updateInfoBlock}
              className="form-grid"
              style={{ maxWidth: "100%" }}
              onSubmit={() => setEditingBlock(null)}
            >
              <InfoBlockFormFields block={editingBlock} />
              <button type="submit">Aktualisieren</button>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
