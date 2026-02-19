"use client";

import {
  createNutritionPlan,
  createNutritionPlanMealEntry,
  createNutritionPlanMealEntryAlternative,
  deleteNutritionPlan,
  deleteNutritionPlanMealEntry,
  deleteNutritionPlanMealEntryAlternative,
  updateNutritionPlan,
  updateNutritionPlanMealEntry,
} from "./actions";
import { useMemo, useState, useTransition } from "react";

type VariantOptionItem = {
  id: string;
  name: string;
};

type IngredientItem = {
  id: string;
  name: string;
};

type MealEntryItem = {
  id: string;
  mealType: string;
  ingredientId: string;
  amount: number;
  unit: string;
  ingredient: {
    id: string;
    name: string;
  };
  alternatives: {
    id: string;
    ingredientId: string;
    ingredient: {
      id: string;
      name: string;
    };
  }[];
};

type NutritionPlanItem = {
  id: string;
  name: string;
  internalName: string;
  description: string | null;
  weekStart: number;
  weekEnd: number;
  variantOptionId: string | null;
  variantOption: {
    id: string;
    name: string;
  } | null;
  mealEntries: MealEntryItem[];
};

type NutritionPlansClientProps = {
  plans: NutritionPlanItem[];
  variantOptions: VariantOptionItem[];
  ingredients: IngredientItem[];
};

const MEAL_SLOTS = [
  { value: "MORNING", label: "Morning" },
  { value: "SNACK_1", label: "Snack 1" },
  { value: "LUNCH", label: "Lunch" },
  { value: "SNACK_2", label: "Snack 2" },
  { value: "DINNER", label: "Dinner" },
  { value: "NIGHT", label: "Night" },
] as const;

const AMOUNT_UNITS = [
  { value: "G", label: "g" },
  { value: "KG", label: "kg" },
  { value: "ML", label: "ml" },
  { value: "L", label: "l" },
  { value: "EL", label: "EL" },
  { value: "TL", label: "TL" },
  { value: "HAND", label: "Hand" },
  { value: "STK", label: "Stk" },
  { value: "PRISE", label: "Prise" },
  { value: "TASSE", label: "Tasse" },
  { value: "SCHEIBE", label: "Scheibe" },
  { value: "BUND", label: "Bund" },
  { value: "DOSE", label: "Dose" },
] as const;

const MEAL_SLOT_LABELS = new Map<string, string>(
  MEAL_SLOTS.map((slot) => [slot.value, slot.label]),
);

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function mealLabel(mealType: string) {
  return MEAL_SLOT_LABELS.get(mealType) ?? mealType;
}

function NutritionPlanFormFields({
  variantOptions,
  plan,
}: {
  variantOptions: VariantOptionItem[];
  plan?: NutritionPlanItem;
}) {
  return (
    <>
      {plan ? <input type="hidden" name="id" value={plan.id} /> : null}
      <label className="field">
        <span>Name</span>
        <input name="name" defaultValue={plan?.name ?? ""} required />
      </label>
      <label className="field">
        <span>Interner Name</span>
        <input
          name="internalName"
          defaultValue={plan?.internalName ?? ""}
          required
        />
      </label>
      <label className="field">
        <span>Beschreibung</span>
        <textarea
          name="description"
          rows={2}
          defaultValue={plan?.description ?? ""}
        />
      </label>
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
            defaultValue={plan?.weekStart ?? 1}
            required
          />
        </label>
        <label className="field">
          <span>Woche bis</span>
          <input
            name="weekEnd"
            type="number"
            min={1}
            defaultValue={plan?.weekEnd ?? 1}
            required
          />
        </label>
      </div>
      <label className="field">
        <span>Ernaehrungsvariante</span>
        <select
          name="variantOptionId"
          defaultValue={plan?.variantOptionId ?? ""}
        >
          <option value="">Keine Ernaehrungsvariante</option>
          {variantOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function NutritionPlanEditorModal({
  plan,
  ingredients,
  onClose,
}: {
  plan: NutritionPlanItem;
  ingredients: IngredientItem[];
  onClose: () => void;
}) {
  const [draftMeals, setDraftMeals] = useState<string[]>([]);
  const [selectedMealType, setSelectedMealType] = useState<string>("");
  const [newMealType, setNewMealType] = useState<string>(MEAL_SLOTS[0].value);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [addFeedback, setAddFeedback] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [pendingIngredientId, setPendingIngredientId] = useState<string | null>(
    null,
  );
  const [alternativePickerMealEntryId, setAlternativePickerMealEntryId] =
    useState<string | null>(null);
  const [alternativeSearch, setAlternativeSearch] = useState("");
  const [alternativeError, setAlternativeError] = useState<string | null>(null);
  const [pendingAlternativeIngredientId, setPendingAlternativeIngredientId] =
    useState<string | null>(null);
  const [isAddingPending, startAddTransition] = useTransition();

  const mealEntryById = useMemo(
    () => new Map(plan.mealEntries.map((entry) => [entry.id, entry])),
    [plan.mealEntries],
  );

  const alternativePickerMealEntry = alternativePickerMealEntryId
    ? (mealEntryById.get(alternativePickerMealEntryId) ?? null)
    : null;

  const orderedMeals = useMemo(() => {
    const merged = new Set<string>([
      ...plan.mealEntries.map((entry) => entry.mealType),
      ...draftMeals,
    ]);

    if (merged.size === 0) {
      merged.add(MEAL_SLOTS[0].value);
    }

    return Array.from(merged).sort(
      (left, right) =>
        MEAL_SLOTS.findIndex((slot) => slot.value === left) -
        MEAL_SLOTS.findIndex((slot) => slot.value === right),
    );
  }, [draftMeals, plan.mealEntries]);

  const activeMealType =
    selectedMealType && orderedMeals.includes(selectedMealType)
      ? selectedMealType
      : (orderedMeals[0] ?? MEAL_SLOTS[0].value);

  const ingredientSearchValue = normalize(ingredientSearch);

  const filteredIngredients = useMemo(() => {
    if (!ingredientSearchValue) {
      return ingredients;
    }

    return ingredients.filter((ingredient) =>
      normalize(ingredient.name).includes(ingredientSearchValue),
    );
  }, [ingredientSearchValue, ingredients]);

  const alternativeSearchValue = normalize(alternativeSearch);
  const alternativePickerIngredients = useMemo(() => {
    if (!alternativePickerMealEntry) {
      return [];
    }

    const blockedIngredientIds = new Set<string>([
      alternativePickerMealEntry.ingredientId,
      ...alternativePickerMealEntry.alternatives.map(
        (entry) => entry.ingredientId,
      ),
    ]);

    return ingredients.filter((ingredient) => {
      if (blockedIngredientIds.has(ingredient.id)) {
        return false;
      }

      if (!alternativeSearchValue) {
        return true;
      }

      return normalize(ingredient.name).includes(alternativeSearchValue);
    });
  }, [alternativePickerMealEntry, alternativeSearchValue, ingredients]);

  function addMeal() {
    if (orderedMeals.includes(newMealType)) {
      setSelectedMealType(newMealType);
      return;
    }

    setDraftMeals((current) => [...current, newMealType]);
    setSelectedMealType(newMealType);
  }

  function handleQuickAdd(ingredient: IngredientItem) {
    const formData = new FormData();
    formData.set("nutritionPlanId", plan.id);
    formData.set("mealType", activeMealType);
    formData.set("ingredientId", ingredient.id);
    formData.set("amount", "0");
    formData.set("unit", "G");

    setPendingIngredientId(ingredient.id);
    setAddError(null);
    setAddFeedback(null);

    startAddTransition(() => {
      createNutritionPlanMealEntry(formData)
        .then(() => {
          setAddFeedback(
            `${ingredient.name} wurde zu ${mealLabel(activeMealType)} hinzugefuegt.`,
          );
          setIngredientSearch("");
        })
        .catch((error: unknown) => {
          setAddError(
            error instanceof Error
              ? error.message
              : "Zutat konnte nicht hinzugefuegt werden.",
          );
        })
        .finally(() => {
          setPendingIngredientId(null);
        });
    });
  }

  function removeAlternativeIngredient(alternativeId: string) {
    const formData = new FormData();
    formData.set("id", alternativeId);

    setAlternativeError(null);

    startAddTransition(() => {
      deleteNutritionPlanMealEntryAlternative(formData).catch(
        (error: unknown) => {
          setAlternativeError(
            error instanceof Error
              ? error.message
              : "Alternative konnte nicht gelöscht werden.",
          );
        },
      );
    });
  }

  function openAlternativePicker(mealEntryId: string) {
    setAlternativePickerMealEntryId(mealEntryId);
    setAlternativeSearch("");
    setAlternativeError(null);
  }

  function closeAlternativePicker() {
    setAlternativePickerMealEntryId(null);
    setAlternativeSearch("");
    setAlternativeError(null);
    setPendingAlternativeIngredientId(null);
  }

  function addAlternativeIngredient(ingredientId: string) {
    if (!alternativePickerMealEntry) {
      return;
    }

    const formData = new FormData();
    formData.set("mealEntryId", alternativePickerMealEntry.id);
    formData.set("ingredientId", ingredientId);

    setPendingAlternativeIngredientId(ingredientId);
    setAlternativeError(null);

    startAddTransition(() => {
      createNutritionPlanMealEntryAlternative(formData)
        .catch((error: unknown) => {
          setAlternativeError(
            error instanceof Error
              ? error.message
              : "Alternative konnte nicht hinzugefügt werden.",
          );
        })
        .finally(() => {
          setPendingAlternativeIngredientId(null);
        });
    });
  }

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
            <h2>Ernaehrungsplan Editor</h2>
            <p className="muted">
              {plan.name} · {plan.internalName}
            </p>
          </div>
          <button type="button" className="admin-icon-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="admin-list-stack" style={{ marginTop: "0.5rem" }}>
          <section className="admin-list-card">
            <div
              className="admin-card-actions"
              style={{ justifyContent: "flex-start", alignItems: "end" }}
            >
              <label className="field" style={{ maxWidth: "260px" }}>
                <span>Neue Mahlzeit</span>
                <select
                  value={newMealType}
                  onChange={(event) => setNewMealType(event.target.value)}
                >
                  {MEAL_SLOTS.map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="admin-secondary-button"
                onClick={addMeal}
              >
                + Mahlzeit erstellen
              </button>
            </div>

            <label className="field" style={{ maxWidth: "280px" }}>
              <span>Aktive Mahlzeit</span>
              <select
                value={activeMealType}
                onChange={(event) => setSelectedMealType(event.target.value)}
                disabled={orderedMeals.length === 0}
              >
                {orderedMeals.map((mealType) => (
                  <option key={mealType} value={mealType}>
                    {mealLabel(mealType)}
                  </option>
                ))}
              </select>
            </label>

            <label className="field" style={{ maxWidth: "420px" }}>
              <span>Zutat suchen</span>
              <input
                value={ingredientSearch}
                onChange={(event) => setIngredientSearch(event.target.value)}
                placeholder="Zutat eingeben..."
              />
            </label>

            {addFeedback ? <p className="muted">{addFeedback}</p> : null}
            {addError ? (
              <p className="training-warning-banner">{addError}</p>
            ) : null}

            {ingredientSearchValue ? (
              <div
                className="admin-list-stack"
                style={{
                  maxHeight: "220px",
                  overflow: "auto",
                  marginTop: "0.25rem",
                  maxWidth: "420px",
                }}
              >
                {filteredIngredients.length === 0 ? (
                  <p className="muted">Keine Zutaten gefunden.</p>
                ) : (
                  filteredIngredients.slice(0, 30).map((ingredient) => (
                    <div
                      key={ingredient.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.5rem",
                        border: "1px solid var(--border)",
                        borderRadius: "10px",
                        background: "#fff",
                        padding: "0.4rem 0.55rem",
                      }}
                    >
                      <span style={{ fontSize: "0.9rem" }}>
                        {ingredient.name}
                      </span>
                      <button
                        type="button"
                        className="admin-plus-button"
                        onClick={() => handleQuickAdd(ingredient)}
                        disabled={isAddingPending}
                        style={{
                          minWidth: "2rem",
                          minHeight: "2rem",
                          padding: 0,
                        }}
                      >
                        {isAddingPending &&
                        pendingIngredientId === ingredient.id
                          ? "…"
                          : "+"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            <p className="muted" style={{ marginTop: "0.5rem" }}>
              Plus fuegt die Zutat sofort mit Menge 0 g hinzu. Mengen kannst du
              unten pro Eintrag setzen und speichern.
            </p>
          </section>

          {orderedMeals.map((mealType) => {
            const entries = plan.mealEntries
              .filter((entry) => entry.mealType === mealType)
              .sort((left, right) =>
                left.ingredient.name.localeCompare(right.ingredient.name),
              );

            return (
              <section key={mealType} className="admin-list-card">
                <div className="admin-list-card-head">
                  <div className="admin-list-title-wrap">
                    <h2>{mealLabel(mealType)}</h2>
                    <p className="muted">{entries.length} Zutaten</p>
                  </div>
                </div>

                {entries.length === 0 ? (
                  <p className="muted">
                    Noch keine Zutaten fuer diese Mahlzeit.
                  </p>
                ) : (
                  <div
                    className="admin-list-stack"
                    style={{ marginTop: "0.25rem" }}
                  >
                    {entries.map((entry) => (
                      <article
                        key={entry.id}
                        className="admin-list-card"
                        style={{ background: "#fff" }}
                      >
                        <form
                          action={updateNutritionPlanMealEntry}
                          className="form-grid"
                          style={{ maxWidth: "100%" }}
                        >
                          <input type="hidden" name="id" value={entry.id} />
                          <input
                            type="hidden"
                            name="mealType"
                            value={mealType}
                          />

                          <label className="field">
                            <span>Zutat</span>
                            <select
                              name="ingredientId"
                              defaultValue={entry.ingredientId}
                              required
                            >
                              {ingredients.map((ingredient) => (
                                <option
                                  key={ingredient.id}
                                  value={ingredient.id}
                                >
                                  {ingredient.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <div
                            style={{
                              display: "grid",
                              gap: "0.5rem",
                              gridTemplateColumns:
                                "minmax(0, 1fr) minmax(0, 1fr)",
                            }}
                          >
                            <label className="field">
                              <span>Menge</span>
                              <input
                                name="amount"
                                type="number"
                                min={0.1}
                                step={0.1}
                                defaultValue={entry.amount}
                                required
                              />
                            </label>
                            <label className="field">
                              <span>Einheit</span>
                              <select name="unit" defaultValue={entry.unit}>
                                {AMOUNT_UNITS.map((unit) => (
                                  <option key={unit.value} value={unit.value}>
                                    {unit.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>

                          <p className="muted">
                            Aktuell: {entry.ingredient.name} · {entry.amount}{" "}
                            {entry.unit}
                          </p>

                          <div
                            className="admin-list-stack"
                            style={{ gap: "0.35rem" }}
                          >
                            <div
                              className="admin-card-actions"
                              style={{ alignItems: "center" }}
                            >
                              <p className="muted" style={{ margin: 0 }}>
                                Alternativen
                              </p>
                              <button
                                type="button"
                                className="admin-plus-button"
                                onClick={() => openAlternativePicker(entry.id)}
                              >
                                +
                              </button>
                            </div>

                            {entry.alternatives.length === 0 ? (
                              <p className="muted">
                                Keine Alternativen hinterlegt.
                              </p>
                            ) : (
                              <div className="admin-card-actions">
                                {entry.alternatives.map((alternative) => (
                                  <button
                                    key={alternative.id}
                                    type="button"
                                    className="admin-secondary-button"
                                    style={{ padding: "0.32rem 0.55rem" }}
                                    onClick={() =>
                                      removeAlternativeIngredient(
                                        alternative.id,
                                      )
                                    }
                                    disabled={isAddingPending}
                                  >
                                    {alternative.ingredient.name} ×
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="admin-card-actions">
                            <button type="submit">Speichern</button>
                            <button
                              type="submit"
                              formAction={deleteNutritionPlanMealEntry}
                              formNoValidate
                              className="admin-danger-button"
                            >
                              Loeschen
                            </button>
                          </div>
                        </form>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {alternativePickerMealEntry ? (
        <div
          className="admin-modal-overlay"
          role="presentation"
          onClick={closeAlternativePicker}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            style={{ width: "min(760px, 100%)" }}
          >
            <div className="admin-modal-head">
              <div>
                <h2>Alternative Zutat hinzufügen</h2>
                <p className="muted" style={{ marginTop: "0.2rem" }}>
                  Primär: {alternativePickerMealEntry.ingredient.name}
                </p>
              </div>
              <button
                type="button"
                className="admin-icon-close"
                onClick={closeAlternativePicker}
              >
                ×
              </button>
            </div>

            <label className="field" style={{ maxWidth: "100%" }}>
              <span>Suche</span>
              <input
                value={alternativeSearch}
                onChange={(event) => setAlternativeSearch(event.target.value)}
                placeholder="Zutat suchen..."
              />
            </label>

            {alternativeError ? (
              <p className="training-warning-banner">{alternativeError}</p>
            ) : null}

            <div
              className="admin-list-stack"
              style={{
                marginTop: "0.5rem",
                maxHeight: "420px",
                overflow: "auto",
              }}
            >
              {alternativePickerIngredients.length === 0 ? (
                <p className="muted">Keine passenden Zutaten gefunden.</p>
              ) : (
                alternativePickerIngredients.map((ingredient) => (
                  <div
                    key={ingredient.id}
                    className="admin-list-card"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      background: "#fff",
                    }}
                  >
                    <span>{ingredient.name}</span>
                    <button
                      type="button"
                      className="admin-plus-button"
                      disabled={
                        isAddingPending &&
                        pendingAlternativeIngredientId === ingredient.id
                      }
                      onClick={() => addAlternativeIngredient(ingredient.id)}
                      style={{
                        minWidth: "2rem",
                        minHeight: "2rem",
                        padding: 0,
                      }}
                    >
                      {isAddingPending &&
                      pendingAlternativeIngredientId === ingredient.id
                        ? "…"
                        : "+"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function NutritionPlansClient({
  plans,
  variantOptions,
  ingredients,
}: NutritionPlansClientProps) {
  const [searchValue, setSearchValue] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<NutritionPlanItem | null>(
    null,
  );
  const [editorPlanId, setEditorPlanId] = useState<string | null>(null);

  const search = normalize(searchValue);

  const filteredPlans = useMemo(() => {
    if (!search) {
      return plans;
    }

    return plans.filter((plan) =>
      `${plan.name} ${plan.internalName} ${plan.description ?? ""} ${plan.variantOption?.name ?? ""}`
        .toLowerCase()
        .includes(search),
    );
  }, [plans, search]);

  const editorPlan = useMemo(
    () => plans.find((plan) => plan.id === editorPlanId) ?? null,
    [editorPlanId, plans],
  );

  return (
    <main className="admin-page-stack">
      <header className="admin-page-head">
        <div>
          <h1 className="page-title" style={{ fontSize: "1.7rem" }}>
            Ernaehrungsplaene
          </h1>
          <p className="muted">Verwalte Ernaehrungsplaene und Mahlzeiten.</p>
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
            placeholder="Name, intern, Beschreibung..."
          />
        </label>
      </section>

      <section className="admin-list-stack">
        {filteredPlans.length === 0 ? (
          <p className="muted">Keine Ernaehrungsplaene gefunden.</p>
        ) : (
          filteredPlans.map((plan) => (
            <article key={plan.id} className="admin-list-card">
              <div className="admin-list-card-head">
                <div className="admin-list-title-wrap">
                  <h2>{plan.name}</h2>
                  <p className="muted">{plan.internalName}</p>
                </div>
                <span className="role-pill">
                  W{plan.weekStart}-W{plan.weekEnd}
                </span>
              </div>

              {plan.description ? <p>{plan.description}</p> : null}

              <p className="muted">
                Variante: {plan.variantOption?.name ?? "Keine"} · Eintraege:{" "}
                {plan.mealEntries.length}
              </p>

              <div className="admin-card-actions">
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() => setEditorPlanId(plan.id)}
                >
                  Editor
                </button>
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() => setEditingPlan(plan)}
                >
                  Bearbeiten
                </button>
                <form action={deleteNutritionPlan}>
                  <input type="hidden" name="id" value={plan.id} />
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
              <h2>Neuer Ernaehrungsplan</h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setIsCreateOpen(false)}
              >
                ×
              </button>
            </div>

            <form
              action={createNutritionPlan}
              className="form-grid"
              onSubmit={() => setIsCreateOpen(false)}
              style={{ maxWidth: "100%" }}
            >
              <NutritionPlanFormFields variantOptions={variantOptions} />
              <button type="submit">Speichern</button>
            </form>
          </div>
        </div>
      ) : null}

      {editingPlan ? (
        <div
          className="admin-modal-overlay"
          role="presentation"
          onClick={() => setEditingPlan(null)}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-head">
              <h2>Ernaehrungsplan bearbeiten</h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setEditingPlan(null)}
              >
                ×
              </button>
            </div>

            <form
              action={updateNutritionPlan}
              className="form-grid"
              onSubmit={() => setEditingPlan(null)}
              style={{ maxWidth: "100%" }}
            >
              <NutritionPlanFormFields
                variantOptions={variantOptions}
                plan={editingPlan}
              />
              <button type="submit">Aktualisieren</button>
            </form>
          </div>
        </div>
      ) : null}

      {editorPlan ? (
        <NutritionPlanEditorModal
          plan={editorPlan}
          ingredients={ingredients}
          onClose={() => setEditorPlanId(null)}
        />
      ) : null}
    </main>
  );
}
