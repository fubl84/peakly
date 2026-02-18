import { roundNutritionValue, type NutritionTotals } from "@/lib/nutrition-computation";

export type NutritionMatchTolerance = {
  caloriesPercent: number;
  carbsPercent: number;
  fatPercent: number;
  proteinPercent: number;
};

export const DEFAULT_NUTRITION_MATCH_TOLERANCE: NutritionMatchTolerance = {
  caloriesPercent: 15,
  carbsPercent: 15,
  fatPercent: 15,
  proteinPercent: 10,
};

export type NutritionDiff = {
  absolute: number;
  percent: number;
};

export type NutritionMatchDiff = {
  calories: NutritionDiff;
  carbs: NutritionDiff;
  fat: NutritionDiff;
  protein: NutritionDiff;
};

export type NutritionMatchResult = {
  isMatch: boolean;
  score: number;
  diffs: NutritionMatchDiff;
};

function calculateDiff(target: number, candidate: number): NutritionDiff {
  const absolute = candidate - target;
  if (target <= 0) {
    return {
      absolute: roundNutritionValue(absolute),
      percent: candidate <= 0 ? 0 : 100,
    };
  }

  return {
    absolute: roundNutritionValue(absolute),
    percent: roundNutritionValue((Math.abs(absolute) / target) * 100),
  };
}

export function getNutritionMatchResult(args: {
  target: Pick<NutritionTotals, "calories" | "carbs" | "fat" | "protein">;
  candidate: Pick<NutritionTotals, "calories" | "carbs" | "fat" | "protein">;
  tolerance?: NutritionMatchTolerance;
}): NutritionMatchResult {
  const tolerance = args.tolerance ?? DEFAULT_NUTRITION_MATCH_TOLERANCE;

  const diffs: NutritionMatchDiff = {
    calories: calculateDiff(args.target.calories, args.candidate.calories),
    carbs: calculateDiff(args.target.carbs, args.candidate.carbs),
    fat: calculateDiff(args.target.fat, args.candidate.fat),
    protein: calculateDiff(args.target.protein, args.candidate.protein),
  };

  const isMatch =
    diffs.calories.percent <= tolerance.caloriesPercent &&
    diffs.carbs.percent <= tolerance.carbsPercent &&
    diffs.fat.percent <= tolerance.fatPercent &&
    diffs.protein.percent <= tolerance.proteinPercent;

  const score = roundNutritionValue(
    diffs.calories.percent +
      diffs.carbs.percent +
      diffs.fat.percent +
      diffs.protein.percent * 1.25,
  );

  return {
    isMatch,
    score,
    diffs,
  };
}
