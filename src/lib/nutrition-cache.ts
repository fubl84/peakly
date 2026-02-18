import { prisma } from "@/lib/prisma";
import {
  computeNutritionTotals,
  toRoundedNutritionTotals,
  type NutritionIngredientInput,
} from "@/lib/nutrition-computation";

type RecipeIngredientNutritionRow = {
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

async function computeRecipeNutritionRows(recipeId: string) {
  const recipeIngredients = await prisma.recipeIngredient.findMany({
    where: { recipeId },
    select: {
      amount: true,
      unit: true,
      ingredient: {
        select: {
          fat: true,
          carbs: true,
          protein: true,
          calories: true,
          fiber: true,
          sugar: true,
          salt: true,
          mlDensityGPerMl: true,
          gramsPerPiece: true,
          gramsPerHand: true,
          gramsPerTeaspoon: true,
          gramsPerTablespoon: true,
          gramsPerPinch: true,
          gramsPerCup: true,
          gramsPerSlice: true,
          gramsPerBunch: true,
          gramsPerCan: true,
        },
      },
    },
  });

  const nutritionInputs: NutritionIngredientInput[] = (
    recipeIngredients as RecipeIngredientNutritionRow[]
  ).map((entry) => ({
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
  }));

  const computed = computeNutritionTotals(nutritionInputs);
  const rounded = toRoundedNutritionTotals(computed.totals);

  return {
    nutritionFat: rounded.fat,
    nutritionCarbs: rounded.carbs,
    nutritionProtein: rounded.protein,
    nutritionCalories: rounded.calories,
    nutritionFiber: rounded.fiber,
    nutritionSugar: rounded.sugar,
    nutritionSalt: rounded.salt,
    nutritionTotalGrams: rounded.grams,
    nutritionWarningCount: computed.warningCount,
    nutritionHasEstimatedConversions: computed.hasEstimatedConversions,
    nutritionComputedAt: new Date(),
  };
}

export async function recomputeRecipeNutritionCache(recipeId: string) {
  const data = await computeRecipeNutritionRows(recipeId);
  await prisma.recipe.update({
    where: { id: recipeId },
    data,
  });
}

export async function recomputeRecipeNutritionCachesByIngredientId(
  ingredientId: string,
) {
  const recipeLinks = await prisma.recipeIngredient.findMany({
    where: { ingredientId },
    select: { recipeId: true },
    distinct: ["recipeId"],
  });

  if (recipeLinks.length === 0) {
    return;
  }

  for (const link of recipeLinks) {
    await recomputeRecipeNutritionCache(link.recipeId);
  }
}
