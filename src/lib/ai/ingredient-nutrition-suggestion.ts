export type IngredientSuggestionConfidence = "HIGH" | "MEDIUM" | "LOW";

export type IngredientNutritionSuggestion = {
  found: boolean;
  confidence: IngredientSuggestionConfidence;
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

function toNullableNumber(value: unknown, field: string) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new Error(`AI-Antwort enthält ungültigen Wert für '${field}'.`);
  }

  return value;
}

export function extractJson(raw: string) {
  const fenced = /```json\s*([\s\S]*?)```/i.exec(raw);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1).trim();
  }

  return raw.trim();
}

export function validateIngredientNutritionSuggestionPayload(
  payload: unknown,
): IngredientNutritionSuggestion {
  if (!payload || typeof payload !== "object") {
    throw new Error("AI-Antwort ist kein JSON-Objekt.");
  }

  const candidate = payload as {
    found?: unknown;
    confidence?: unknown;
    reason?: unknown;
    nutritionPer100g?: unknown;
    conversionEstimates?: unknown;
    needsAlternativeDescription?: unknown;
    suggestedAlternativeDescription?: unknown;
  };

  if (typeof candidate.found !== "boolean") {
    throw new Error("AI-Antwort enthält kein gültiges 'found'-Feld.");
  }

  if (
    candidate.confidence !== "HIGH" &&
    candidate.confidence !== "MEDIUM" &&
    candidate.confidence !== "LOW"
  ) {
    throw new Error("AI-Antwort enthält kein gültiges 'confidence'-Feld.");
  }

  if (
    typeof candidate.reason !== "string" ||
    candidate.reason.trim().length < 3
  ) {
    throw new Error("AI-Antwort enthält keine gültige Begründung.");
  }

  if (
    !candidate.nutritionPer100g ||
    typeof candidate.nutritionPer100g !== "object"
  ) {
    throw new Error("AI-Antwort enthält keine gültigen Makro-Werte.");
  }

  const nutritionCandidate = candidate.nutritionPer100g as {
    calories?: unknown;
    protein?: unknown;
    carbs?: unknown;
    fat?: unknown;
    fiber?: unknown;
    sugar?: unknown;
    salt?: unknown;
  };

  if (
    !candidate.conversionEstimates ||
    typeof candidate.conversionEstimates !== "object"
  ) {
    throw new Error("AI-Antwort enthält keine gültigen Umrechnungswerte.");
  }

  const conversionCandidate = candidate.conversionEstimates as {
    mlDensityGPerMl?: unknown;
    gramsPerPiece?: unknown;
    gramsPerHand?: unknown;
    gramsPerTeaspoon?: unknown;
    gramsPerTablespoon?: unknown;
    gramsPerPinch?: unknown;
    gramsPerCup?: unknown;
    gramsPerSlice?: unknown;
    gramsPerBunch?: unknown;
    gramsPerCan?: unknown;
  };

  if (typeof candidate.needsAlternativeDescription !== "boolean") {
    throw new Error(
      "AI-Antwort enthält kein gültiges 'needsAlternativeDescription'-Feld.",
    );
  }

  const suggestedAlternativeDescription =
    candidate.suggestedAlternativeDescription === null ||
    typeof candidate.suggestedAlternativeDescription === "string"
      ? candidate.suggestedAlternativeDescription
      : "";

  if (suggestedAlternativeDescription === "") {
    throw new Error(
      "AI-Antwort enthält ein ungültiges 'suggestedAlternativeDescription'-Feld.",
    );
  }

  return {
    found: candidate.found,
    confidence: candidate.confidence,
    reason: candidate.reason.trim(),
    nutritionPer100g: {
      calories: toNullableNumber(nutritionCandidate.calories, "calories"),
      protein: toNullableNumber(nutritionCandidate.protein, "protein"),
      carbs: toNullableNumber(nutritionCandidate.carbs, "carbs"),
      fat: toNullableNumber(nutritionCandidate.fat, "fat"),
      fiber: toNullableNumber(nutritionCandidate.fiber, "fiber"),
      sugar: toNullableNumber(nutritionCandidate.sugar, "sugar"),
      salt: toNullableNumber(nutritionCandidate.salt, "salt"),
    },
    conversionEstimates: {
      mlDensityGPerMl: toNullableNumber(
        conversionCandidate.mlDensityGPerMl,
        "mlDensityGPerMl",
      ),
      gramsPerPiece: toNullableNumber(
        conversionCandidate.gramsPerPiece,
        "gramsPerPiece",
      ),
      gramsPerHand: toNullableNumber(
        conversionCandidate.gramsPerHand,
        "gramsPerHand",
      ),
      gramsPerTeaspoon: toNullableNumber(
        conversionCandidate.gramsPerTeaspoon,
        "gramsPerTeaspoon",
      ),
      gramsPerTablespoon: toNullableNumber(
        conversionCandidate.gramsPerTablespoon,
        "gramsPerTablespoon",
      ),
      gramsPerPinch: toNullableNumber(
        conversionCandidate.gramsPerPinch,
        "gramsPerPinch",
      ),
      gramsPerCup: toNullableNumber(
        conversionCandidate.gramsPerCup,
        "gramsPerCup",
      ),
      gramsPerSlice: toNullableNumber(
        conversionCandidate.gramsPerSlice,
        "gramsPerSlice",
      ),
      gramsPerBunch: toNullableNumber(
        conversionCandidate.gramsPerBunch,
        "gramsPerBunch",
      ),
      gramsPerCan: toNullableNumber(
        conversionCandidate.gramsPerCan,
        "gramsPerCan",
      ),
    },
    needsAlternativeDescription: candidate.needsAlternativeDescription,
    suggestedAlternativeDescription,
  };
}

export function parseIngredientNutritionSuggestionResponse(raw: string) {
  const jsonText = extractJson(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("AI-Antwort konnte nicht als JSON gelesen werden.");
  }

  return validateIngredientNutritionSuggestionPayload(parsed);
}
