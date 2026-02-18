"use client";

import { Bot, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type RecipeCard = {
  id: string;
  name: string;
  description: string | null;
  tips: string | null;
  imageUrl: string | null;
  variantName: string | null;
  nutrition: {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  };
  ingredients: string[];
  steps: string[];
};

type NutritionRecipesClientProps = {
  recipes: RecipeCard[];
};

function formatOneDecimal(value: number | null) {
  if (value === null) {
    return "-";
  }

  return value.toFixed(1);
}

export function NutritionRecipesClient({
  recipes,
}: NutritionRecipesClientProps) {
  const [query, setQuery] = useState("");
  const [variantOnly, setVariantOnly] = useState(false);
  const [requireNutrition, setRequireNutrition] = useState(true);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState<string | null>(null);
  const [assistantError, setAssistantError] = useState<string | null>(null);

  const recipeById = useMemo(
    () => new Map(recipes.map((recipe) => [recipe.id, recipe])),
    [recipes],
  );

  const selectedRecipe = selectedRecipeId
    ? recipeById.get(selectedRecipeId)
    : null;

  const filteredRecipes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return recipes.filter((recipe) => {
      if (variantOnly && !recipe.variantName) {
        return false;
      }

      if (
        requireNutrition &&
        (recipe.nutrition.calories === null ||
          recipe.nutrition.protein === null ||
          recipe.nutrition.carbs === null ||
          recipe.nutrition.fat === null)
      ) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const inText =
        recipe.name.toLowerCase().includes(normalizedQuery) ||
        (recipe.description ?? "").toLowerCase().includes(normalizedQuery) ||
        recipe.ingredients.some((line) =>
          line.toLowerCase().includes(normalizedQuery),
        );

      return inText;
    });
  }, [recipes, query, variantOnly, requireNutrition]);

  useEffect(() => {
    if (!selectedRecipeId) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedRecipeId(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedRecipeId]);

  async function askAssistant() {
    if (!assistantInput.trim()) {
      setAssistantError("Bitte gib zuerst eine konkrete Rezeptfrage ein.");
      setAssistantMessage(null);
      return;
    }

    setAssistantError(null);
    setAssistantMessage(null);
    setAssistantLoading(true);

    try {
      const response = await fetch("/api/ai/nutrition-recipes-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ note: assistantInput }),
      });

      const payload = (await response.json()) as {
        data?: { message?: string };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error || "AI-Anfrage fehlgeschlagen.");
      }

      setAssistantMessage(payload.data?.message ?? "Keine Antwort erhalten.");
    } catch (error) {
      setAssistantError(
        error instanceof Error ? error.message : "Unbekannter AI-Fehler.",
      );
    } finally {
      setAssistantLoading(false);
    }
  }

  return (
    <>
      <section className="card stack nutrition-recipes-toolbar">
        <div className="nutrition-recipes-search-wrap">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Rezept, Zutat oder Beschreibung suchen ..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="nutrition-recipes-filter-row">
          <label className="variant-option-row nutrition-variant-only">
            <input
              type="checkbox"
              checked={variantOnly}
              onChange={(event) => setVariantOnly(event.target.checked)}
            />
            Nur Varianten-Rezepte
          </label>

          <label className="variant-option-row nutrition-variant-only">
            <input
              type="checkbox"
              checked={requireNutrition}
              onChange={(event) => setRequireNutrition(event.target.checked)}
            />
            Nur mit vollständigen Nährwerten
          </label>

          <span className="calendar-day-tag">
            {filteredRecipes.length} Rezepte
          </span>
        </div>
      </section>

      <section className="card stack nutrition-assistant-wrap">
        <button
          type="button"
          className="nutrition-assistant-bubble"
          onClick={() => setAssistantOpen((prev) => !prev)}
        >
          <Bot size={16} aria-hidden="true" /> Rezepte AI fragen
        </button>
        {assistantOpen ? (
          <>
            <p className="muted">
              Beispiel: „Ich möchte ein Rezept mit Lachs, aber maximal 25g
              Fett.“
            </p>
            <textarea
              rows={3}
              placeholder="Deine Frage zu Rezepten und Nährwerten ..."
              value={assistantInput}
              onChange={(event) => setAssistantInput(event.target.value)}
            />
            <button
              type="button"
              onClick={askAssistant}
              disabled={assistantLoading}
            >
              {assistantLoading ? "Analysiere ..." : "AI Empfehlung abrufen"}
            </button>
            {assistantError ? (
              <p className="error-text">{assistantError}</p>
            ) : null}
            {assistantMessage ? (
              <article className="nutrition-assistant-message">
                <p>{assistantMessage}</p>
              </article>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="nutrition-recipe-grid nutrition-recipes-page-grid">
        {filteredRecipes.length === 0 ? (
          <article className="card stack">
            <h3>Keine passenden Rezepte</h3>
            <p className="muted">
              Passe Suche oder Filter an, um weitere Treffer zu sehen.
            </p>
          </article>
        ) : null}

        {filteredRecipes.map((recipe) => (
          <article
            key={recipe.id}
            className="nutrition-recipe-card nutrition-recipes-product-card"
          >
            <div className="nutrition-recipe-card-top">
              <p className="nutrition-recipe-card-title">{recipe.name}</p>
              <button
                type="button"
                className="training-icon-button"
                onClick={() => setSelectedRecipeId(recipe.id)}
                aria-label={`${recipe.name} Details öffnen`}
              >
                Details
              </button>
            </div>

            <div className="nutrition-recipe-card-badges">
              {recipe.variantName ? (
                <span className="path-kind-pill is-nutrition">
                  Variante: {recipe.variantName}
                </span>
              ) : (
                <span className="path-kind-pill">Allgemein</span>
              )}
            </div>

            {recipe.description ? (
              <p className="muted nutrition-recipe-desc">
                {recipe.description}
              </p>
            ) : null}

            <div className="nutrition-slot-macro-grid nutrition-recipes-macro-grid">
              <span className="nutrition-slot-macro-pill">
                <small>Kalorien</small>
                <strong>
                  {formatOneDecimal(recipe.nutrition.calories)} kcal
                </strong>
              </span>
              <span className="nutrition-slot-macro-pill">
                <small>Protein</small>
                <strong>{formatOneDecimal(recipe.nutrition.protein)} g</strong>
              </span>
              <span className="nutrition-slot-macro-pill">
                <small>Kohlenhydrate</small>
                <strong>{formatOneDecimal(recipe.nutrition.carbs)} g</strong>
              </span>
              <span className="nutrition-slot-macro-pill">
                <small>Fett</small>
                <strong>{formatOneDecimal(recipe.nutrition.fat)} g</strong>
              </span>
            </div>
          </article>
        ))}
      </section>

      {selectedRecipe ? (
        <div
          className="path-modal-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.currentTarget === event.target) {
              setSelectedRecipeId(null);
            }
          }}
        >
          <section
            className="path-modal nutrition-modal"
            role="dialog"
            aria-modal="true"
          >
            <header className="path-modal-head">
              <div className="path-modal-title-wrap">
                <span className="path-product-chip">Rezeptdetails</span>
                <h3 className="path-modal-title">{selectedRecipe.name}</h3>
              </div>
              <button
                type="button"
                className="path-modal-close"
                onClick={() => setSelectedRecipeId(null)}
                aria-label="Details schließen"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            {selectedRecipe.description ? (
              <p>{selectedRecipe.description}</p>
            ) : null}
            {selectedRecipe.tips ? (
              <article className="motivation-band">
                <strong>Tipp</strong>
                <p>{selectedRecipe.tips}</p>
              </article>
            ) : null}

            <section className="stack">
              <h4>Zutaten</h4>
              {selectedRecipe.ingredients.length === 0 ? (
                <p className="muted">Keine Zutaten hinterlegt.</p>
              ) : (
                <ul className="nutrition-detail-list">
                  {selectedRecipe.ingredients.map((line, index) => (
                    <li key={`${line}:${index}`}>{line}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="stack">
              <h4>Zubereitung</h4>
              {selectedRecipe.steps.length === 0 ? (
                <p className="muted">Keine Schritte hinterlegt.</p>
              ) : (
                <ol className="nutrition-detail-list">
                  {selectedRecipe.steps.map((line, index) => (
                    <li key={`${line}:${index}`}>{line}</li>
                  ))}
                </ol>
              )}
            </section>
          </section>
        </div>
      ) : null}
    </>
  );
}
