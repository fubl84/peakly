"use client";

import {
  createRecipe,
  createRecipeIngredient,
  createRecipeStep,
  deleteRecipe,
  deleteRecipeIngredient,
  deleteRecipeStep,
  reorderRecipeSteps,
  updateRecipe,
  updateRecipeIngredient,
  updateRecipeStep,
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

type RecipeItem = {
  id: string;
  name: string;
  internalName: string;
  description: string | null;
  imageUrl: string | null;
  tips: string | null;
  variantOptionId: string | null;
  variantOption: {
    id: string;
    name: string;
  } | null;
  ingredients: {
    id: string;
    ingredientId: string;
    amount: number;
    unit: string;
    ingredient: {
      id: string;
      name: string;
    };
  }[];
  steps: {
    id: string;
    position: number;
    description: string;
  }[];
};

type RecipesClientProps = {
  recipes: RecipeItem[];
  variantOptions: VariantOptionItem[];
  ingredients: IngredientItem[];
};

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

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function RecipeFormFields({
  variantOptions,
  recipe,
}: {
  variantOptions: VariantOptionItem[];
  recipe?: RecipeItem;
}) {
  return (
    <>
      {recipe ? <input type="hidden" name="id" value={recipe.id} /> : null}
      <label className="field">
        <span>Name</span>
        <input name="name" defaultValue={recipe?.name ?? ""} required />
      </label>
      <label className="field">
        <span>Interner Name</span>
        <input
          name="internalName"
          defaultValue={recipe?.internalName ?? ""}
          required
        />
      </label>
      <label className="field">
        <span>Beschreibung</span>
        <textarea
          name="description"
          rows={2}
          defaultValue={recipe?.description ?? ""}
        />
      </label>
      <label className="field">
        <span>Bild-URL</span>
        <input name="imageUrl" defaultValue={recipe?.imageUrl ?? ""} />
      </label>
      <label className="field">
        <span>Tipps</span>
        <textarea name="tips" rows={2} defaultValue={recipe?.tips ?? ""} />
      </label>
      <label className="field">
        <span>Variante</span>
        <select name="variantOptionId" defaultValue={recipe?.variantOptionId ?? ""}>
          <option value="">Keine Variante</option>
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

function RecipeEditorModal({
  recipe,
  ingredients,
  onClose,
}: {
  recipe: RecipeItem;
  ingredients: IngredientItem[];
  onClose: () => void;
}) {
  const [ingredientPickerOpen, setIngredientPickerOpen] = useState(false);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [stepModalOpen, setStepModalOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<RecipeItem["steps"][number] | null>(
    null,
  );
  const [stepDraft, setStepDraft] = useState("");
  const [stepDragId, setStepDragId] = useState<string | null>(null);
  const [stepReorderError, setStepReorderError] = useState<string | null>(null);
  const [ingredientFeedback, setIngredientFeedback] = useState<string | null>(null);
  const [ingredientError, setIngredientError] = useState<string | null>(null);
  const [pendingIngredientId, setPendingIngredientId] = useState<string | null>(null);
  const [isIngredientPending, startIngredientTransition] = useTransition();
  const [isStepReorderPending, startStepReorderTransition] = useTransition();

  const ingredientSearchValue = normalize(ingredientSearch);
  const filteredIngredients = useMemo(() => {
    if (!ingredientSearchValue) {
      return ingredients;
    }

    return ingredients.filter((item) =>
      normalize(item.name).includes(ingredientSearchValue),
    );
  }, [ingredientSearchValue, ingredients]);

  const ingredientById = useMemo(
    () => new Map(recipe.ingredients.map((entry) => [entry.ingredientId, entry])),
    [recipe.ingredients],
  );

  const orderedSteps = useMemo(
    () => [...recipe.steps].sort((left, right) => left.position - right.position),
    [recipe.steps],
  );

  function openCreateStepModal() {
    setEditingStep(null);
    setStepDraft("");
    setStepModalOpen(true);
  }

  function openEditStepModal(step: RecipeItem["steps"][number]) {
    setEditingStep(step);
    setStepDraft(step.description);
    setStepModalOpen(true);
  }

  function handleStepDrop(targetId: string | null) {
    if (!stepDragId) {
      return;
    }

    const orderedIds = orderedSteps.map((step) => step.id);
    const fromIndex = orderedIds.findIndex((id) => id === stepDragId);
    if (fromIndex < 0) {
      setStepDragId(null);
      return;
    }

    const [movedId] = orderedIds.splice(fromIndex, 1);
    if (!targetId) {
      orderedIds.push(movedId);
    } else {
      const targetIndex = orderedIds.findIndex((id) => id === targetId);
      orderedIds.splice(targetIndex < 0 ? orderedIds.length : targetIndex, 0, movedId);
    }

    setStepDragId(null);
    setStepReorderError(null);

    const formData = new FormData();
    formData.set("recipeId", recipe.id);
    formData.set("orderedStepIds", JSON.stringify(orderedIds));

    startStepReorderTransition(() => {
      reorderRecipeSteps(formData).catch((error: unknown) => {
        setStepReorderError(
          error instanceof Error
            ? error.message
            : "Schritt-Reihenfolge konnte nicht gespeichert werden.",
        );
      });
    });
  }

  function toggleIngredient(ingredient: IngredientItem, shouldAdd: boolean) {
    const existing = ingredientById.get(ingredient.id);

    if (shouldAdd && existing) {
      return;
    }

    if (!shouldAdd && !existing) {
      return;
    }

    setPendingIngredientId(ingredient.id);
    setIngredientError(null);
    setIngredientFeedback(null);

    startIngredientTransition(() => {
      if (shouldAdd) {
        const formData = new FormData();
        formData.set("recipeId", recipe.id);
        formData.set("ingredientId", ingredient.id);
        formData.set("amount", "0");
        formData.set("unit", "G");

        createRecipeIngredient(formData)
          .then(() => {
            setIngredientFeedback(`${ingredient.name} hinzugefuegt.`);
          })
          .catch((error: unknown) => {
            setIngredientError(
              error instanceof Error
                ? error.message
                : "Zutat konnte nicht hinzugefuegt werden.",
            );
          })
          .finally(() => setPendingIngredientId(null));
        return;
      }

      const formData = new FormData();
      formData.set("id", existing!.id);
      deleteRecipeIngredient(formData)
        .then(() => {
          setIngredientFeedback(`${ingredient.name} entfernt.`);
        })
        .catch((error: unknown) => {
          setIngredientError(
            error instanceof Error
              ? error.message
              : "Zutat konnte nicht entfernt werden.",
          );
        })
        .finally(() => setPendingIngredientId(null));
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
            <h2>Recipe Editor</h2>
            <p className="muted">
              {recipe.name} · {recipe.internalName}
            </p>
          </div>
          <button type="button" className="admin-icon-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="admin-list-stack" style={{ marginTop: "0.5rem" }}>
          <section className="admin-list-card">
            <div className="admin-list-card-head">
              <div className="admin-list-title-wrap">
                <h2>Zutaten</h2>
                <p className="muted">
                  Ueber den Button Zutaten hinzufuegen oeffnest du die Suchliste zum
                  Abhaken.
                </p>
              </div>
              <button
                type="button"
                className="admin-plus-button"
                onClick={() => setIngredientPickerOpen(true)}
              >
                Zutaten hinzufuegen
              </button>
            </div>

            {ingredientFeedback ? <p className="muted">{ingredientFeedback}</p> : null}
            {ingredientError ? (
              <p className="training-warning-banner">{ingredientError}</p>
            ) : null}

            {recipe.ingredients.length === 0 ? (
              <p className="muted">Noch keine Zutaten im Rezept.</p>
            ) : (
              <div className="admin-list-stack" style={{ marginTop: "0.25rem" }}>
                {recipe.ingredients
                  .slice()
                  .sort((left, right) =>
                    left.ingredient.name.localeCompare(right.ingredient.name),
                  )
                  .map((entry) => (
                    <article
                      key={entry.id}
                      className="admin-list-card"
                      style={{ background: "#fff" }}
                    >
                      <form
                        action={updateRecipeIngredient}
                        className="form-grid"
                        style={{ maxWidth: "100%" }}
                      >
                        <input type="hidden" name="id" value={entry.id} />

                        <label className="field">
                          <span>Zutat</span>
                          <select name="ingredientId" defaultValue={entry.ingredientId}>
                            {ingredients.map((ingredient) => (
                              <option key={ingredient.id} value={ingredient.id}>
                                {ingredient.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div
                          style={{
                            display: "grid",
                            gap: "0.5rem",
                            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                          }}
                        >
                          <label className="field">
                            <span>Menge</span>
                            <input
                              name="amount"
                              type="number"
                              min={0}
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

                        <div className="admin-card-actions">
                          <button type="submit">Speichern</button>
                          <button
                            type="submit"
                            formAction={deleteRecipeIngredient}
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

          <section className="admin-list-card">
            <div className="admin-list-card-head">
              <div className="admin-list-title-wrap">
                <h2>Schritte</h2>
                <p className="muted">
                  Neue Schritte per Modal erfassen und Reihenfolge per Drag-and-drop
                  aendern.
                </p>
              </div>
              <button
                type="button"
                className="admin-plus-button"
                onClick={openCreateStepModal}
              >
                Schritt hinzufuegen
              </button>
            </div>

            {stepReorderError ? (
              <p className="training-warning-banner">{stepReorderError}</p>
            ) : null}

            {orderedSteps.length === 0 ? (
              <p className="muted">Noch keine Schritte vorhanden.</p>
            ) : (
              <div className="admin-list-stack" style={{ marginTop: "0.25rem" }}>
                {orderedSteps.map((step) => (
                  <article
                    key={step.id}
                    className="admin-list-card"
                    draggable
                    onDragStart={() => setStepDragId(step.id)}
                    onDragEnd={() => setStepDragId(null)}
                    onDragOver={(event) => {
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleStepDrop(step.id);
                    }}
                    style={{ cursor: "grab", background: "#fff" }}
                  >
                    <div className="admin-list-card-head">
                      <div className="admin-list-title-wrap">
                        <h3 style={{ margin: 0 }}>Schritt {step.position}</h3>
                        <p>{step.description}</p>
                      </div>
                      <div className="admin-card-actions">
                        <button
                          type="button"
                          className="admin-secondary-button"
                          onClick={() => openEditStepModal(step)}
                        >
                          Bearbeiten
                        </button>
                        <form action={deleteRecipeStep}>
                          <input type="hidden" name="id" value={step.id} />
                          <button type="submit" className="admin-danger-button">
                            Loeschen
                          </button>
                        </form>
                      </div>
                    </div>
                  </article>
                ))}

                <div
                  className="muted"
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    handleStepDrop(null);
                  }}
                  style={{
                    border: "1px dashed var(--border)",
                    borderRadius: "10px",
                    padding: "0.5rem 0.65rem",
                    textAlign: "center",
                    background: "#faf8ff",
                  }}
                >
                  Hierher ziehen, um ans Ende zu verschieben
                  {isStepReorderPending ? " · Speichert..." : ""}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {ingredientPickerOpen ? (
        <div
          className="admin-modal-overlay"
          role="presentation"
          onClick={() => setIngredientPickerOpen(false)}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            style={{ width: "min(760px, 100%)" }}
          >
            <div className="admin-modal-head">
              <h2>Zutaten auswaehlen</h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setIngredientPickerOpen(false)}
              >
                ×
              </button>
            </div>

            <label className="field" style={{ maxWidth: "100%" }}>
              <span>Suche</span>
              <input
                value={ingredientSearch}
                onChange={(event) => setIngredientSearch(event.target.value)}
                placeholder="Zutat suchen..."
              />
            </label>

            <div
              className="admin-list-stack"
              style={{ marginTop: "0.5rem", maxHeight: "420px", overflow: "auto" }}
            >
              {filteredIngredients.length === 0 ? (
                <p className="muted">Keine Zutaten gefunden.</p>
              ) : (
                filteredIngredients.map((ingredient) => {
                  const existing = ingredientById.get(ingredient.id);
                  const isPending =
                    isIngredientPending && pendingIngredientId === ingredient.id;

                  return (
                    <label
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
                      <input
                        type="checkbox"
                        checked={Boolean(existing)}
                        disabled={isPending}
                        onChange={(event) =>
                          toggleIngredient(ingredient, event.target.checked)
                        }
                        aria-label={`${ingredient.name} zu Rezept hinzufügen`}
                      />
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}

      {stepModalOpen ? (
        <div
          className="admin-modal-overlay"
          role="presentation"
          onClick={() => setStepModalOpen(false)}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            style={{ width: "min(640px, 100%)" }}
          >
            <div className="admin-modal-head">
              <h2>{editingStep ? "Schritt bearbeiten" : "Neuer Schritt"}</h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setStepModalOpen(false)}
              >
                ×
              </button>
            </div>

            <form
              action={editingStep ? updateRecipeStep : createRecipeStep}
              className="form-grid"
              style={{ maxWidth: "100%" }}
              onSubmit={() => setStepModalOpen(false)}
            >
              {editingStep ? (
                <input type="hidden" name="id" value={editingStep.id} />
              ) : (
                <input type="hidden" name="recipeId" value={recipe.id} />
              )}
              <label className="field">
                <span>Schrittbeschreibung</span>
                <textarea
                  name="description"
                  rows={5}
                  value={stepDraft}
                  onChange={(event) => setStepDraft(event.target.value)}
                  required
                />
              </label>
              <button type="submit">
                {editingStep ? "Aktualisieren" : "Hinzufuegen"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RecipesClient({
  recipes,
  variantOptions,
  ingredients,
}: RecipesClientProps) {
  const [searchValue, setSearchValue] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<RecipeItem | null>(null);
  const [editorRecipeId, setEditorRecipeId] = useState<string | null>(null);

  const search = normalize(searchValue);

  const filteredRecipes = useMemo(() => {
    if (!search) {
      return recipes;
    }

    return recipes.filter((recipe) =>
      `${recipe.name} ${recipe.internalName} ${recipe.description ?? ""} ${recipe.variantOption?.name ?? ""}`
        .toLowerCase()
        .includes(search),
    );
  }, [recipes, search]);

  const editorRecipe = useMemo(
    () => recipes.find((recipe) => recipe.id === editorRecipeId) ?? null,
    [editorRecipeId, recipes],
  );

  return (
    <main className="admin-page-stack">
      <header className="admin-page-head">
        <div>
          <h1 className="page-title" style={{ fontSize: "1.7rem" }}>
            Rezepte
          </h1>
          <p className="muted">Verwalte Rezepte, Zutaten und Schritte.</p>
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
        {filteredRecipes.length === 0 ? (
          <p className="muted">Keine Rezepte gefunden.</p>
        ) : (
          filteredRecipes.map((recipe) => (
            <article key={recipe.id} className="admin-list-card">
              <div className="admin-list-card-head">
                <div className="admin-list-title-wrap">
                  <h2>{recipe.name}</h2>
                  <p className="muted">{recipe.internalName}</p>
                </div>
                <span className="role-pill">
                  {recipe.steps.length} Schritte · {recipe.ingredients.length} Zutaten
                </span>
              </div>

              {recipe.description ? <p>{recipe.description}</p> : null}
              <p className="muted">Variante: {recipe.variantOption?.name ?? "Keine"}</p>

              <div className="admin-card-actions">
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() => setEditorRecipeId(recipe.id)}
                >
                  Editor
                </button>
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={() => setEditingRecipe(recipe)}
                >
                  Bearbeiten
                </button>
                <form action={deleteRecipe}>
                  <input type="hidden" name="id" value={recipe.id} />
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
              <h2>Neues Rezept</h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setIsCreateOpen(false)}
              >
                ×
              </button>
            </div>

            <form
              action={createRecipe}
              className="form-grid"
              onSubmit={() => setIsCreateOpen(false)}
              style={{ maxWidth: "100%" }}
            >
              <RecipeFormFields variantOptions={variantOptions} />
              <button type="submit">Speichern</button>
            </form>
          </div>
        </div>
      ) : null}

      {editingRecipe ? (
        <div
          className="admin-modal-overlay"
          role="presentation"
          onClick={() => setEditingRecipe(null)}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="admin-modal-head">
              <h2>Rezept bearbeiten</h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setEditingRecipe(null)}
              >
                ×
              </button>
            </div>

            <form
              action={updateRecipe}
              className="form-grid"
              onSubmit={() => setEditingRecipe(null)}
              style={{ maxWidth: "100%" }}
            >
              <RecipeFormFields variantOptions={variantOptions} recipe={editingRecipe} />
              <button type="submit">Aktualisieren</button>
            </form>
          </div>
        </div>
      ) : null}

      {editorRecipe ? (
        <RecipeEditorModal
          recipe={editorRecipe}
          ingredients={ingredients}
          onClose={() => setEditorRecipeId(null)}
        />
      ) : null}
    </main>
  );
}
