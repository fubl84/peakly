"use client";

import {
  createIngredient,
  deleteIngredient,
  updateIngredient,
} from "./actions";
import { IngredientAiSuggestion } from "./ingredient-ai-suggestion";
import { useMemo, useState } from "react";

type IngredientItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  mlDensityGPerMl: number | null;
  gramsPerPiece: number | null;
  gramsPerHand: number | null;
  gramsPerTeaspoon: number | null;
  gramsPerTablespoon: number | null;
  gramsPerPinch: number | null;
  gramsPerCup: number | null;
  gramsPerSlice: number | null;
  gramsPerBunch: number | null;
  gramsPerCan: number | null;
  fat: number | null;
  carbs: number | null;
  protein: number | null;
  calories: number | null;
  fiber: number | null;
  sugar: number | null;
  salt: number | null;
};

type IngredientsClientProps = {
  ingredients: IngredientItem[];
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function macroField(label: string, name: string, defaultValue?: number | null) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} type="number" step="0.01" defaultValue={defaultValue ?? ""} />
    </label>
  );
}

function conversionField(
  label: string,
  name: string,
  defaultValue?: number | null,
) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} type="number" step="0.01" defaultValue={defaultValue ?? ""} />
    </label>
  );
}

function IngredientFormFields({ ingredient }: { ingredient?: IngredientItem }) {
  return (
    <>
      {ingredient ? <input type="hidden" name="id" value={ingredient.id} /> : null}
      <label className="field">
        <span>Name</span>
        <input name="name" defaultValue={ingredient?.name ?? ""} required />
      </label>
      <label className="field">
        <span>Beschreibung</span>
        <textarea
          name="description"
          rows={2}
          defaultValue={ingredient?.description ?? ""}
        />
      </label>
      <label className="field">
        <span>Bild-URL</span>
        <input
          name="imageUrl"
          defaultValue={ingredient?.imageUrl ?? ""}
          placeholder="Bild-URL (optional)"
        />
      </label>

      <IngredientAiSuggestion />

      <div
        style={{
          display: "grid",
          gap: "0.5rem",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        }}
      >
        {conversionField(
          "Dichte g/ml (für ML/L)",
          "mlDensityGPerMl",
          ingredient?.mlDensityGPerMl,
        )}
        {conversionField("g pro Stück", "gramsPerPiece", ingredient?.gramsPerPiece)}
        {conversionField("g pro Hand", "gramsPerHand", ingredient?.gramsPerHand)}
        {conversionField(
          "g pro TL",
          "gramsPerTeaspoon",
          ingredient?.gramsPerTeaspoon,
        )}
        {conversionField(
          "g pro EL",
          "gramsPerTablespoon",
          ingredient?.gramsPerTablespoon,
        )}
        {conversionField("g pro Prise", "gramsPerPinch", ingredient?.gramsPerPinch)}
        {conversionField("g pro Tasse", "gramsPerCup", ingredient?.gramsPerCup)}
        {conversionField("g pro Scheibe", "gramsPerSlice", ingredient?.gramsPerSlice)}
        {conversionField("g pro Bund", "gramsPerBunch", ingredient?.gramsPerBunch)}
        {conversionField("g pro Dose", "gramsPerCan", ingredient?.gramsPerCan)}
      </div>

      <div
        style={{
          display: "grid",
          gap: "0.5rem",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        }}
      >
        {macroField("Fett / 100g", "fat", ingredient?.fat)}
        {macroField("Kohlenhydrate / 100g", "carbs", ingredient?.carbs)}
        {macroField("Protein / 100g", "protein", ingredient?.protein)}
        {macroField("Kalorien / 100g", "calories", ingredient?.calories)}
        {macroField("Ballaststoffe / 100g", "fiber", ingredient?.fiber)}
        {macroField("Zucker / 100g", "sugar", ingredient?.sugar)}
        {macroField("Salz / 100g", "salt", ingredient?.salt)}
      </div>
    </>
  );
}

export function IngredientsClient({ ingredients }: IngredientsClientProps) {
  const [searchValue, setSearchValue] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<IngredientItem | null>(
    null,
  );

  const search = normalize(searchValue);

  const filteredIngredients = useMemo(() => {
    if (!search) {
      return ingredients;
    }

    return ingredients.filter((ingredient) =>
      `${ingredient.name} ${ingredient.description ?? ""} ${ingredient.imageUrl ?? ""}`
        .toLowerCase()
        .includes(search),
    );
  }, [ingredients, search]);

  return (
    <main className="admin-page-stack">
      <header className="admin-page-head">
        <div>
          <h1 className="page-title" style={{ fontSize: "1.7rem" }}>
            Zutaten
          </h1>
          <p className="muted">Verwalte Zutaten inkl. KI-Nährwertvorschlag.</p>
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
            placeholder="Name, Beschreibung…"
          />
        </label>
      </section>

      <section className="admin-list-stack">
        {filteredIngredients.length === 0 ? (
          <p className="muted">Keine Zutaten gefunden.</p>
        ) : (
          filteredIngredients.map((ingredient) => (
            <article key={ingredient.id} className="admin-list-card">
              <div className="admin-list-card-head">
                <div className="admin-list-title-wrap">
                  <h2>{ingredient.name}</h2>
                  <p className="muted">
                    kcal {ingredient.calories ?? "-"} · P {ingredient.protein ?? "-"} · KH{" "}
                    {ingredient.carbs ?? "-"} · F {ingredient.fat ?? "-"}
                  </p>
                </div>
                <span className="role-pill">Zutat</span>
              </div>

              {ingredient.description ? <p>{ingredient.description}</p> : null}

              <p className="muted">
                Umrechnung: Stk {ingredient.gramsPerPiece ?? "-"}g · Hand{" "}
                {ingredient.gramsPerHand ?? "-"}g · TL {ingredient.gramsPerTeaspoon ?? "-"}g
              </p>

              <div className="admin-card-actions">
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() => setEditingIngredient(ingredient)}
                >
                  Bearbeiten
                </button>
                <form action={deleteIngredient}>
                  <input type="hidden" name="id" value={ingredient.id} />
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
              <h2>Neue Zutat</h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setIsCreateOpen(false)}
              >
                ×
              </button>
            </div>

            <form
              action={createIngredient}
              className="form-grid"
              onSubmit={() => setIsCreateOpen(false)}
              style={{ maxWidth: "100%" }}
            >
              <IngredientFormFields />
              <button type="submit">Speichern</button>
            </form>
          </div>
        </div>
      ) : null}

      {editingIngredient ? (
        <div
          className="admin-modal-overlay"
          role="presentation"
          onClick={() => setEditingIngredient(null)}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-head">
              <h2>Zutat bearbeiten</h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setEditingIngredient(null)}
              >
                ×
              </button>
            </div>

            <form
              action={updateIngredient}
              className="form-grid"
              onSubmit={() => setEditingIngredient(null)}
              style={{ maxWidth: "100%" }}
            >
              <IngredientFormFields ingredient={editingIngredient} />
              <button type="submit">Aktualisieren</button>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
