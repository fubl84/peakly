import { computeNutritionTotals, toRoundedNutritionTotals } from "@/lib/nutrition-computation";
import { getNutritionMatchResult } from "@/lib/nutrition-matching";

export type SlotTargetInput = {
  amount: number;
  unit: string;
  ingredient: {
    fat: number | null;
    carbs: number | null;
    protein: number | null;
    calories: number | null;
    fiber: number | null;
    sugar: number | null;
    salt: number | null;
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
};

export type SlotNutritionTarget = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  warningCount: number;
  hasEstimatedConversions: boolean;
};

export type SlotRecipeCandidate = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type SlotRecipeMatch = {
  id: string;
  name: string;
  score: number;
  caloriesDiffPercent: number;
  proteinDiffPercent: number;
  carbsDiffPercent: number;
  fatDiffPercent: number;
};

export function buildSlotNutritionTarget(entries: SlotTargetInput[]) {
  const computed = computeNutritionTotals(
    entries.map((entry) => ({
      amount: entry.amount,
      unit: entry.unit,
      nutritionPer100g: {
        fat: entry.ingredient.fat,
        carbs: entry.ingredient.carbs,
        protein: entry.ingredient.protein,
        calories: entry.ingredient.calories,
        fiber: entry.ingredient.fiber,
        sugar: entry.ingredient.sugar,
        salt: entry.ingredient.salt,
      },
      conversion: {
        mlDensityGPerMl: entry.ingredient.mlDensityGPerMl,
        gramsPerPiece: entry.ingredient.gramsPerPiece,
        gramsPerHand: entry.ingredient.gramsPerHand,
        gramsPerTeaspoon: entry.ingredient.gramsPerTeaspoon,
        gramsPerTablespoon: entry.ingredient.gramsPerTablespoon,
        gramsPerPinch: entry.ingredient.gramsPerPinch,
        gramsPerCup: entry.ingredient.gramsPerCup,
        gramsPerSlice: entry.ingredient.gramsPerSlice,
        gramsPerBunch: entry.ingredient.gramsPerBunch,
        gramsPerCan: entry.ingredient.gramsPerCan,
      },
    })),
  );

  const rounded = toRoundedNutritionTotals(computed.totals);

  return {
    calories: rounded.calories,
    protein: rounded.protein,
    carbs: rounded.carbs,
    fat: rounded.fat,
    warningCount: computed.warningCount,
    hasEstimatedConversions: computed.hasEstimatedConversions,
  } satisfies SlotNutritionTarget;
}

export function getSlotRecipeMatches(args: {
  target: SlotNutritionTarget;
  recipes: SlotRecipeCandidate[];
  limit?: number;
}) {
  const matched = args.recipes
    .map((recipe) => {
      const result = getNutritionMatchResult({
        target: {
          calories: args.target.calories,
          protein: args.target.protein,
          carbs: args.target.carbs,
          fat: args.target.fat,
        },
        candidate: {
          calories: recipe.calories,
          protein: recipe.protein,
          carbs: recipe.carbs,
          fat: recipe.fat,
        },
      });

      if (!result.isMatch) {
        return null;
      }

      return {
        id: recipe.id,
        name: recipe.name,
        score: result.score,
        caloriesDiffPercent: result.diffs.calories.percent,
        proteinDiffPercent: result.diffs.protein.percent,
        carbsDiffPercent: result.diffs.carbs.percent,
        fatDiffPercent: result.diffs.fat.percent,
      } satisfies SlotRecipeMatch;
    })
    .filter((entry): entry is SlotRecipeMatch => Boolean(entry));

  matched.sort((a, b) => a.score - b.score);

  return matched.slice(0, args.limit ?? 5);
}
