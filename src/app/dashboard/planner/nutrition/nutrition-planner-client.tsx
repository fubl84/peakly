"use client";

import { Bot, Info, Plus, ShoppingCart, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  addNutritionSlotIngredientsToShoppingListAction,
  upsertNutritionCalendarEntryAction,
} from "./actions";

type SlotIngredient = {
  label: string;
};

type SlotTargetNutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  warningCount: number;
  hasEstimatedConversions: boolean;
};

type SlotRecipeMatch = {
  id: string;
  name: string;
  score: number;
  caloriesDiffPercent: number;
  proteinDiffPercent: number;
  carbsDiffPercent: number;
  fatDiffPercent: number;
};

type SlotView = {
  mealType: string;
  mealLabel: string;
  selectedRecipeId: string | null;
  selectedRecipeName: string | null;
  targetNutrition: SlotTargetNutrition | null;
  recipeMatches: SlotRecipeMatch[];
  baseIngredients: SlotIngredient[];
};

type DayCard = {
  dayOfWeek: number;
  dayLabel: string;
  slots: SlotView[];
};

type RecipeDetail = {
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

type NutritionPlannerClientProps = {
  week: number;
  dayCards: DayCard[];
  recipes: RecipeDetail[];
};

type AssignModalState = {
  dayOfWeek: number;
  dayLabel: string;
  mealType: string;
  mealLabel: string;
  selectedRecipeId: string | null;
  selectedRecipeName: string | null;
  targetNutrition: SlotTargetNutrition | null;
  recipeMatches: SlotRecipeMatch[];
};

type CalendarViewMode = "WEEKLY" | "DAILY";

function resolveCurrentDayOfWeek() {
  const today = new Date().getDay();
  return today === 0 ? 7 : today;
}

function formatOneDecimal(value: number) {
  return value.toFixed(1);
}

function splitIngredientLine(line: string) {
  const parts = line.split(" · ");
  if (parts.length < 2) {
    return {
      name: line,
      amount: "",
    };
  }

  return {
    name: parts.slice(0, -1).join(" · "),
    amount: parts[parts.length - 1] ?? "",
  };
}

function resolveDefaultExpandedDay(dayCards: DayCard[]) {
  const currentDay = resolveCurrentDayOfWeek();
  const hasCurrentDay = dayCards.some((day) => day.dayOfWeek === currentDay);
  if (hasCurrentDay) {
    return currentDay;
  }

  return dayCards[0]?.dayOfWeek ?? 1;
}

export function NutritionPlannerClient({
  week,
  dayCards,
  recipes,
}: NutritionPlannerClientProps) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>("DAILY");
  const [expandedDayOfWeek, setExpandedDayOfWeek] = useState<number>(() =>
    resolveDefaultExpandedDay(dayCards),
  );
  const [assignModal, setAssignModal] = useState<AssignModalState | null>(null);
  const [recipeDetailId, setRecipeDetailId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [sortMode, setSortMode] = useState<"AZ" | "ZA">("AZ");
  const [variantOnly, setVariantOnly] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantInput, setAssistantInput] = useState("");
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState<string | null>(null);
  const [assistantError, setAssistantError] = useState<string | null>(null);

  const hasOpenModal = Boolean(assignModal || recipeDetailId);

  useEffect(() => {
    if (!hasOpenModal) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAssignModal(null);
        setRecipeDetailId(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [hasOpenModal]);

  useEffect(() => {
    if (!dayCards.length) {
      return;
    }

    const expandedDayExists = dayCards.some(
      (day) => day.dayOfWeek === expandedDayOfWeek,
    );

    if (!expandedDayExists) {
      setExpandedDayOfWeek(resolveDefaultExpandedDay(dayCards));
    }
  }, [dayCards, expandedDayOfWeek]);

  const recipeById = useMemo(
    () =>
      new Map<string, RecipeDetail>(
        recipes.map((recipe) => [recipe.id, recipe]),
      ),
    [recipes],
  );

  const selectedRecipeDetail = recipeDetailId
    ? (recipeById.get(recipeDetailId) ?? null)
    : null;

  const assignModalMatchByRecipeId = useMemo(
    () =>
      new Map<string, SlotRecipeMatch>(
        (assignModal?.recipeMatches ?? []).map((entry) => [entry.id, entry]),
      ),
    [assignModal],
  );

  const filteredRecipes = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    const filtered = recipes.filter((recipe) => {
      if (variantOnly && !recipe.variantName) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        recipe.name.toLowerCase().includes(query) ||
        (recipe.description ?? "").toLowerCase().includes(query)
      );
    });

    filtered.sort((a, b) => {
      const aMatch = assignModalMatchByRecipeId.get(a.id);
      const bMatch = assignModalMatchByRecipeId.get(b.id);

      if (aMatch && bMatch) {
        return aMatch.score - bMatch.score;
      }

      if (aMatch) {
        return -1;
      }

      if (bMatch) {
        return 1;
      }

      return sortMode === "AZ"
        ? a.name.localeCompare(b.name, "de")
        : b.name.localeCompare(a.name, "de");
    });

    return filtered;
  }, [recipes, searchText, sortMode, variantOnly, assignModalMatchByRecipeId]);

  async function runNutritionAssistant() {
    setAssistantError(null);
    setAssistantMessage(null);
    setAssistantLoading(true);

    try {
      const response = await fetch("/api/ai/nutrition-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          week,
          mealType: assignModal?.mealType ?? null,
          note: assistantInput,
        }),
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

  function renderDayCard(day: DayCard) {
    return (
      <article key={day.dayOfWeek} className="calendar-day nutrition-day-card">
        <div className="calendar-day-title">
          <strong>{day.dayLabel}</strong>
          <span className="calendar-day-tag">{day.slots.length} Slots</span>
        </div>

        <div className="nutrition-slot-stack">
          {day.slots.map((slot) => {
            const slotRecipe = slot.selectedRecipeId
              ? (recipeById.get(slot.selectedRecipeId) ?? null)
              : null;

            return (
              <article
                key={`${day.dayOfWeek}:${slot.mealType}`}
                className="nutrition-slot-card"
              >
                <div className="nutrition-slot-head">
                  <div>
                    <strong>{slot.mealLabel}</strong>
                    <p className="muted">
                      {slot.selectedRecipeName ? "Rezept aktiv" : "Basis-Slot"}
                    </p>
                  </div>

                  <div className="nutrition-slot-actions">
                    <button
                      type="button"
                      className="training-icon-button"
                      onClick={() =>
                        setAssignModal({
                          dayOfWeek: day.dayOfWeek,
                          dayLabel: day.dayLabel,
                          mealType: slot.mealType,
                          mealLabel: slot.mealLabel,
                          selectedRecipeId: slot.selectedRecipeId,
                          selectedRecipeName: slot.selectedRecipeName,
                          targetNutrition: slot.targetNutrition,
                          recipeMatches: slot.recipeMatches,
                        })
                      }
                      aria-label={`${slot.mealLabel} Rezept zuweisen`}
                    >
                      <Plus size={16} aria-hidden="true" />
                    </button>

                    <form
                      action={addNutritionSlotIngredientsToShoppingListAction}
                    >
                      <input type="hidden" name="week" value={week} />
                      <input
                        type="hidden"
                        name="dayOfWeek"
                        value={day.dayOfWeek}
                      />
                      <input
                        type="hidden"
                        name="mealType"
                        value={slot.mealType}
                      />
                      <button
                        type="submit"
                        className="training-icon-button"
                        aria-label={`${slot.mealLabel} Zutaten zur Einkaufsliste hinzufügen`}
                      >
                        <ShoppingCart size={16} aria-hidden="true" />
                      </button>
                    </form>

                    {slotRecipe ? (
                      <button
                        type="button"
                        className="training-icon-button"
                        aria-label={`${slotRecipe.name} Details anzeigen`}
                        onClick={() => setRecipeDetailId(slotRecipe.id)}
                      >
                        <Info size={16} aria-hidden="true" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {slot.selectedRecipeName ? (
                  <p className="nutrition-slot-recipe-pill">
                    {slot.selectedRecipeName}
                  </p>
                ) : null}

                {slot.targetNutrition ? (
                  <div className="nutrition-slot-macro-wrap">
                    <p className="nutrition-slot-macro-title">
                      Zielwerte je Slot
                    </p>
                    <div className="nutrition-slot-macro-grid">
                      <span className="nutrition-slot-macro-pill is-calories">
                        <small>Kalorien</small>
                        <strong>
                          {formatOneDecimal(slot.targetNutrition.calories)} kcal
                        </strong>
                      </span>
                      <span className="nutrition-slot-macro-pill is-protein">
                        <small>Protein</small>
                        <strong>
                          {formatOneDecimal(slot.targetNutrition.protein)} g
                        </strong>
                      </span>
                      <span className="nutrition-slot-macro-pill is-carbs">
                        <small>Kohlenhydrate</small>
                        <strong>
                          {formatOneDecimal(slot.targetNutrition.carbs)} g
                        </strong>
                      </span>
                      <span className="nutrition-slot-macro-pill is-fat">
                        <small>Fett</small>
                        <strong>
                          {formatOneDecimal(slot.targetNutrition.fat)} g
                        </strong>
                      </span>
                    </div>
                    {slot.targetNutrition.hasEstimatedConversions ? (
                      <p className="nutrition-slot-macro-note">
                        Einzelne Umrechnungen sind geschätzt.
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {slot.recipeMatches.length > 0 ? (
                  <div className="nutrition-match-chip-row">
                    {slot.recipeMatches.slice(0, 3).map((match) => (
                      <span key={match.id} className="nutrition-match-chip">
                        {match.name} · ΔP {match.proteinDiffPercent.toFixed(1)}%
                      </span>
                    ))}
                  </div>
                ) : null}

                <ul className="nutrition-slot-ingredient-list">
                  {(slotRecipe?.ingredients.length
                    ? slotRecipe.ingredients
                    : slot.baseIngredients.map((entry) => entry.label)
                  ).map((line, index) => {
                    const ingredient = splitIngredientLine(line);

                    return (
                      <li
                        key={`${line}:${index}`}
                        className="nutrition-slot-ingredient-item"
                      >
                        {ingredient.amount ? (
                          <span className="nutrition-slot-ingredient-amount">
                            {ingredient.amount}
                          </span>
                        ) : null}
                        <span className="nutrition-slot-ingredient-name">
                          {ingredient.name}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </div>
      </article>
    );
  }

  return (
    <>
      <section className="card stack">
        <h2 className="section-title">Ernährungskalender</h2>
        <p className="muted">
          Klare Wochenansicht. Über + weist du pro Slot ein Rezept zu.
        </p>

        <div className="nutrition-view-toggle-row">
          <button
            type="button"
            className={`nutrition-view-toggle ${
              viewMode === "DAILY" ? "is-active" : ""
            }`}
            onClick={() => setViewMode("DAILY")}
          >
            Tagesfokus
          </button>
          <button
            type="button"
            className={`nutrition-view-toggle ${
              viewMode === "WEEKLY" ? "is-active" : ""
            }`}
            onClick={() => setViewMode("WEEKLY")}
          >
            Wochenansicht
          </button>
        </div>

        {viewMode === "WEEKLY" ? (
          <div className="calendar-grid">
            {dayCards.map((day) => renderDayCard(day))}
          </div>
        ) : (
          <div className="nutrition-daily-focus-list">
            {dayCards.map((day) => {
              const isExpanded = day.dayOfWeek === expandedDayOfWeek;

              return (
                <article
                  key={day.dayOfWeek}
                  className={`nutrition-focus-day ${isExpanded ? "is-expanded" : ""}`}
                >
                  <button
                    type="button"
                    className={`nutrition-focus-day-bar ${
                      isExpanded ? "is-expanded" : ""
                    }`}
                    onClick={() => setExpandedDayOfWeek(day.dayOfWeek)}
                    aria-expanded={isExpanded}
                  >
                    <strong>{day.dayLabel}</strong>
                    <span className="calendar-day-tag">
                      {day.slots.length} Slots
                    </span>
                  </button>

                  <div
                    className={`nutrition-focus-day-panel ${
                      isExpanded ? "is-expanded" : ""
                    }`}
                  >
                    <div className="nutrition-focus-day-panel-inner">
                      {renderDayCard(day)}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="card stack nutrition-assistant-wrap">
        <button
          type="button"
          className="nutrition-assistant-bubble"
          onClick={() => setAssistantOpen((prev) => !prev)}
        >
          <Bot size={16} aria-hidden="true" /> AI Ernährungshelfer
        </button>

        {assistantOpen ? (
          <div className="nutrition-assistant-panel">
            <p className="muted">
              Frag nach Wochenempfehlungen und passenden Rezeptideen für die
              aktuelle Woche.
            </p>
            <textarea
              rows={3}
              placeholder="z. B. Ich brauche einfache Lunch-Ideen für stressige Tage."
              value={assistantInput}
              onChange={(event) => setAssistantInput(event.target.value)}
            />
            <button
              type="button"
              onClick={runNutritionAssistant}
              disabled={assistantLoading}
            >
              {assistantLoading ? "Analysiere ..." : "Empfehlung abrufen"}
            </button>

            {assistantError ? (
              <p className="error-text">{assistantError}</p>
            ) : null}
            {assistantMessage ? (
              <article className="nutrition-assistant-message">
                <p>{assistantMessage}</p>
              </article>
            ) : null}
          </div>
        ) : null}
      </section>

      {assignModal ? (
        <div
          className="path-modal-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.currentTarget === event.target) {
              setAssignModal(null);
            }
          }}
        >
          <section
            className="path-modal nutrition-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Rezeptauswahl für ${assignModal.dayLabel} ${assignModal.mealLabel}`}
          >
            <header className="path-modal-head">
              <div className="path-modal-title-wrap">
                <span className="path-product-chip">Rezept zuweisen</span>
                <h3 className="path-modal-title">
                  {assignModal.dayLabel} · {assignModal.mealLabel}
                </h3>
                <p className="muted">
                  Rezepte durchsuchen, filtern und auswählen.
                </p>
                {assignModal.targetNutrition ? (
                  <p className="muted">
                    Zielwerte:{" "}
                    {formatOneDecimal(assignModal.targetNutrition.calories)}{" "}
                    kcal · P{" "}
                    {formatOneDecimal(assignModal.targetNutrition.protein)} · KH{" "}
                    {formatOneDecimal(assignModal.targetNutrition.carbs)} · F{" "}
                    {formatOneDecimal(assignModal.targetNutrition.fat)}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                className="path-modal-close"
                onClick={() => setAssignModal(null)}
                aria-label="Modal schließen"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div className="nutrition-recipe-filter-row">
              <input
                type="search"
                placeholder="Rezept suchen ..."
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />

              <select
                value={sortMode}
                onChange={(event) =>
                  setSortMode(event.target.value as "AZ" | "ZA")
                }
              >
                <option value="AZ">A–Z</option>
                <option value="ZA">Z–A</option>
              </select>

              <label className="variant-option-row nutrition-variant-only">
                <input
                  type="checkbox"
                  checked={variantOnly}
                  onChange={(event) => setVariantOnly(event.target.checked)}
                />
                Nur Varianten-Rezepte
              </label>
            </div>

            {assignModal.selectedRecipeName ? (
              <p className="training-warning-banner">
                Aktuell ausgewählt:{" "}
                <strong>{assignModal.selectedRecipeName}</strong>
              </p>
            ) : null}

            {assignModal.recipeMatches.length > 0 ? (
              <div className="nutrition-match-chip-row">
                {assignModal.recipeMatches.slice(0, 5).map((match) => (
                  <span key={match.id} className="nutrition-match-chip">
                    {match.name} · kcal {match.caloriesDiffPercent.toFixed(1)}%
                    · P {match.proteinDiffPercent.toFixed(1)}%
                  </span>
                ))}
              </div>
            ) : null}

            <form action={upsertNutritionCalendarEntryAction}>
              <input type="hidden" name="week" value={week} />
              <input
                type="hidden"
                name="dayOfWeek"
                value={assignModal.dayOfWeek}
              />
              <input
                type="hidden"
                name="mealType"
                value={assignModal.mealType}
              />
              <input type="hidden" name="recipeId" value="" />
              <button type="submit" className="nutrition-clear-recipe-button">
                Basis-Zutaten verwenden (Rezept entfernen)
              </button>
            </form>

            <div className="nutrition-recipe-grid">
              {filteredRecipes.map((recipe) => (
                <article key={recipe.id} className="nutrition-recipe-card">
                  {assignModalMatchByRecipeId.get(recipe.id) ? (
                    <p className="nutrition-match-hint">
                      Passender Treffer · Score{" "}
                      {assignModalMatchByRecipeId
                        .get(recipe.id)
                        ?.score.toFixed(1)}
                    </p>
                  ) : null}
                  <div className="nutrition-recipe-card-top">
                    <p className="nutrition-recipe-card-title">{recipe.name}</p>
                    <button
                      type="button"
                      className="training-icon-button"
                      aria-label={`${recipe.name} Details anzeigen`}
                      onClick={() => setRecipeDetailId(recipe.id)}
                    >
                      <Info size={16} aria-hidden="true" />
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

                  <form action={upsertNutritionCalendarEntryAction}>
                    <input type="hidden" name="week" value={week} />
                    <input
                      type="hidden"
                      name="dayOfWeek"
                      value={assignModal.dayOfWeek}
                    />
                    <input
                      type="hidden"
                      name="mealType"
                      value={assignModal.mealType}
                    />
                    <input type="hidden" name="recipeId" value={recipe.id} />
                    <button type="submit">Dieses Rezept wählen</button>
                  </form>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {selectedRecipeDetail ? (
        <div
          className="path-modal-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.currentTarget === event.target) {
              setRecipeDetailId(null);
            }
          }}
        >
          <section
            className="path-modal nutrition-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Rezeptdetails ${selectedRecipeDetail.name}`}
          >
            <header className="path-modal-head">
              <div className="path-modal-title-wrap">
                <span className="path-product-chip">Rezeptdetails</span>
                <h3 className="path-modal-title">
                  {selectedRecipeDetail.name}
                </h3>
              </div>

              <button
                type="button"
                className="path-modal-close"
                onClick={() => setRecipeDetailId(null)}
                aria-label="Details schließen"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            {selectedRecipeDetail.description ? (
              <p>{selectedRecipeDetail.description}</p>
            ) : null}

            {selectedRecipeDetail.tips ? (
              <article className="motivation-band">
                <strong>Tipp</strong>
                <p>{selectedRecipeDetail.tips}</p>
              </article>
            ) : null}

            <section className="stack">
              <h4>Zutaten</h4>
              {selectedRecipeDetail.ingredients.length === 0 ? (
                <p className="muted">Keine Zutaten hinterlegt.</p>
              ) : (
                <ul className="nutrition-detail-list">
                  {selectedRecipeDetail.ingredients.map((line, index) => (
                    <li key={`${line}:${index}`}>{line}</li>
                  ))}
                </ul>
              )}
            </section>

            <section className="stack">
              <h4>Zubereitung</h4>
              {selectedRecipeDetail.steps.length === 0 ? (
                <p className="muted">Keine Schritte hinterlegt.</p>
              ) : (
                <ol className="nutrition-detail-list">
                  {selectedRecipeDetail.steps.map((line, index) => (
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
