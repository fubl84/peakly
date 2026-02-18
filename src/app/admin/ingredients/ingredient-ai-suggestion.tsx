"use client";

import { useMemo, useRef, useState } from "react";

type IngredientNutritionSuggestion = {
  found: boolean;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
  nutritionPer100g: {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    fiber: number | null;
    sugar: number | null;
    salt: number | null;
  };
  conversionEstimates: {
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
  };
  needsAlternativeDescription: boolean;
  suggestedAlternativeDescription: string | null;
};

type Props = {
  defaultLanguage?: "de" | "en";
};

const FIELD_ORDER: Array<
  keyof IngredientNutritionSuggestion["nutritionPer100g"]
> = ["fat", "carbs", "protein", "calories", "fiber", "sugar", "salt"];

const CONVERSION_FIELD_ORDER: Array<
  keyof IngredientNutritionSuggestion["conversionEstimates"]
> = [
  "mlDensityGPerMl",
  "gramsPerPiece",
  "gramsPerHand",
  "gramsPerTeaspoon",
  "gramsPerTablespoon",
  "gramsPerPinch",
  "gramsPerCup",
  "gramsPerSlice",
  "gramsPerBunch",
  "gramsPerCan",
];

function formatConfidence(value: IngredientNutritionSuggestion["confidence"]) {
  if (value === "HIGH") return "Hoch";
  if (value === "MEDIUM") return "Mittel";
  return "Niedrig";
}

export function IngredientAiSuggestion({ defaultLanguage = "de" }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [language, setLanguage] = useState<"de" | "en">(defaultLanguage);
  const [alternativeDescription, setAlternativeDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] =
    useState<IngredientNutritionSuggestion | null>(null);

  const canApply = useMemo(() => {
    if (!suggestion) {
      return false;
    }

    return (
      Object.values(suggestion.nutritionPer100g).some(
        (value) => typeof value === "number",
      ) ||
      Object.values(suggestion.conversionEstimates).some(
        (value) => typeof value === "number",
      )
    );
  }, [suggestion]);

  async function requestSuggestion() {
    const form = containerRef.current?.closest(
      "form",
    ) as HTMLFormElement | null;
    if (!form) {
      setError("Formular wurde nicht gefunden.");
      return;
    }

    const ingredientName = String(
      (form.elements.namedItem("name") as HTMLInputElement | null)?.value ?? "",
    ).trim();
    const description = String(
      (form.elements.namedItem("description") as HTMLTextAreaElement | null)
        ?.value ?? "",
    ).trim();

    if (!ingredientName) {
      setError("Bitte zuerst einen Zutatennamen eingeben.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/admin/ingredients/nutrition-suggestion",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ingredientName,
            description,
            alternativeDescription,
            language,
          }),
        },
      );

      const payload = (await response.json()) as {
        data?: IngredientNutritionSuggestion;
        error?: string;
      };

      if (!response.ok || !payload.data) {
        throw new Error(
          payload.error || "KI-Vorschlag konnte nicht geladen werden.",
        );
      }

      setSuggestion(payload.data);

      if (
        payload.data.needsAlternativeDescription &&
        payload.data.suggestedAlternativeDescription
      ) {
        setAlternativeDescription(payload.data.suggestedAlternativeDescription);
      }
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "KI-Vorschlag konnte nicht geladen werden.";
      setError(message);
      setSuggestion(null);
    } finally {
      setIsLoading(false);
    }
  }

  function applySuggestionToForm() {
    if (!suggestion) {
      return;
    }

    const form = containerRef.current?.closest(
      "form",
    ) as HTMLFormElement | null;
    if (!form) {
      setError("Formular wurde nicht gefunden.");
      return;
    }

    for (const key of FIELD_ORDER) {
      const value = suggestion.nutritionPer100g[key];
      const element = form.elements.namedItem(key) as HTMLInputElement | null;
      if (!element) {
        continue;
      }

      element.value = typeof value === "number" ? String(value) : "";
    }

    for (const key of CONVERSION_FIELD_ORDER) {
      const value = suggestion.conversionEstimates[key];
      const element = form.elements.namedItem(key) as HTMLInputElement | null;
      if (!element) {
        continue;
      }

      element.value = typeof value === "number" ? String(value) : "";
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        border: "1px dashed var(--border)",
        borderRadius: 8,
        padding: "0.75rem",
        display: "grid",
        gap: "0.5rem",
      }}
    >
      <strong>KI-Nährwertvorschlag (pro 100g)</strong>
      <p className="muted" style={{ margin: 0 }}>
        Suche zuerst in FDDB (de), danach bei unzureichenden Daten in weiteren
        Quellen.
      </p>
      <div
        style={{
          display: "grid",
          gap: "0.5rem",
          gridTemplateColumns: "1fr 2fr",
        }}
      >
        <label style={{ display: "grid", gap: "0.25rem" }}>
          Antwortsprache
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value as "de" | "en")}
          >
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          Alternative Beschreibung (optional)
          <input
            value={alternativeDescription}
            onChange={(event) => setAlternativeDescription(event.target.value)}
            placeholder="z.B. genauer Produktname oder Synonym"
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" onClick={requestSuggestion} disabled={isLoading}>
          {isLoading ? "Lade KI-Vorschlag..." : "KI-Vorschlag laden"}
        </button>
        <button
          type="button"
          onClick={applySuggestionToForm}
          disabled={!canApply}
        >
          Vorschlag in Felder übernehmen
        </button>
      </div>

      {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}

      {suggestion ? (
        <div style={{ display: "grid", gap: "0.25rem", fontSize: "0.92rem" }}>
          <p>
            <strong>Status:</strong>{" "}
            {suggestion.found ? "Gefunden" : "Unsicher / nicht gefunden"}
          </p>
          <p>
            <strong>Konfidenz:</strong>{" "}
            {formatConfidence(suggestion.confidence)}
          </p>
          <p>
            <strong>Hinweis:</strong> {suggestion.reason}
          </p>
          {suggestion.needsAlternativeDescription ? (
            <p style={{ color: "#8a4b08" }}>
              KI empfiehlt eine alternative Beschreibung für bessere Treffer.
            </p>
          ) : null}
          <p>
            kcal: {suggestion.nutritionPer100g.calories ?? "-"} · Protein:{" "}
            {suggestion.nutritionPer100g.protein ?? "-"} · KH:{" "}
            {suggestion.nutritionPer100g.carbs ?? "-"} · Fett:{" "}
            {suggestion.nutritionPer100g.fat ?? "-"}
          </p>
          <p>
            Umrechnung: Hand{" "}
            {suggestion.conversionEstimates.gramsPerHand ?? "-"}g · Stk{" "}
            {suggestion.conversionEstimates.gramsPerPiece ?? "-"}g · Bund{" "}
            {suggestion.conversionEstimates.gramsPerBunch ?? "-"}g · Tasse{" "}
            {suggestion.conversionEstimates.gramsPerCup ?? "-"}g
          </p>
        </div>
      ) : null}
    </div>
  );
}
