import {
  calculateNutritionBy100gWithConversion,
  type IngredientConversionOverrides,
  type UnitConversionWarning,
} from "@/lib/unit-conversion";

export type NutritionTotals = {
  grams: number;
  fat: number;
  carbs: number;
  protein: number;
  calories: number;
  fiber: number;
  sugar: number;
  salt: number;
};

export type NutritionIngredientInput = {
  amount: number;
  unit: string;
  nutritionPer100g: {
    fat?: number | null;
    carbs?: number | null;
    protein?: number | null;
    calories?: number | null;
    fiber?: number | null;
    sugar?: number | null;
    salt?: number | null;
  };
  conversion?: IngredientConversionOverrides;
};

export type NutritionComputationResult = {
  totals: NutritionTotals;
  warnings: UnitConversionWarning[];
  warningCount: number;
  hasEstimatedConversions: boolean;
};

export function roundNutritionValue(value: number) {
  return Math.round(value * 10) / 10;
}

export function computeNutritionTotals(
  inputs: NutritionIngredientInput[],
): NutritionComputationResult {
  const totals: NutritionTotals = {
    grams: 0,
    fat: 0,
    carbs: 0,
    protein: 0,
    calories: 0,
    fiber: 0,
    sugar: 0,
    salt: 0,
  };

  const warnings: UnitConversionWarning[] = [];
  let hasEstimatedConversions = false;

  for (const entry of inputs) {
    const nutrition = calculateNutritionBy100gWithConversion({
      amount: entry.amount,
      unit: entry.unit,
      ingredient: entry.conversion,
      nutritionPer100g: entry.nutritionPer100g,
    });

    if (nutrition.warnings.length > 0) {
      warnings.push(...nutrition.warnings);
    }

    if (nutrition.isEstimated) {
      hasEstimatedConversions = true;
    }

    totals.grams += nutrition.grams ?? 0;
    totals.fat += nutrition.fat;
    totals.carbs += nutrition.carbs;
    totals.protein += nutrition.protein;
    totals.calories += nutrition.calories;
    totals.fiber += nutrition.fiber;
    totals.sugar += nutrition.sugar;
    totals.salt += nutrition.salt;
  }

  return {
    totals,
    warnings,
    warningCount: warnings.length,
    hasEstimatedConversions,
  };
}

export function toRoundedNutritionTotals(totals: NutritionTotals): NutritionTotals {
  return {
    grams: roundNutritionValue(totals.grams),
    fat: roundNutritionValue(totals.fat),
    carbs: roundNutritionValue(totals.carbs),
    protein: roundNutritionValue(totals.protein),
    calories: roundNutritionValue(totals.calories),
    fiber: roundNutritionValue(totals.fiber),
    sugar: roundNutritionValue(totals.sugar),
    salt: roundNutritionValue(totals.salt),
  };
}
