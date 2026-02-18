"use server";

import { assertAdminAction } from "@/lib/admin-action";
import {
  getOptionalNumber,
  getOptionalString,
  getRequiredString,
} from "@/lib/forms";
import { recomputeRecipeNutritionCachesByIngredientId } from "@/lib/nutrition-cache";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createIngredient(formData: FormData) {
  await assertAdminAction();

  const name = getRequiredString(formData, "name");
  const description = getOptionalString(formData, "description");
  const imageUrl = getOptionalString(formData, "imageUrl");

  await prisma.ingredient.create({
    data: {
      name,
      description,
      imageUrl,
      mlDensityGPerMl: getOptionalNumber(formData, "mlDensityGPerMl"),
      gramsPerPiece: getOptionalNumber(formData, "gramsPerPiece"),
      gramsPerHand: getOptionalNumber(formData, "gramsPerHand"),
      gramsPerTeaspoon: getOptionalNumber(formData, "gramsPerTeaspoon"),
      gramsPerTablespoon: getOptionalNumber(formData, "gramsPerTablespoon"),
      gramsPerPinch: getOptionalNumber(formData, "gramsPerPinch"),
      gramsPerCup: getOptionalNumber(formData, "gramsPerCup"),
      gramsPerSlice: getOptionalNumber(formData, "gramsPerSlice"),
      gramsPerBunch: getOptionalNumber(formData, "gramsPerBunch"),
      gramsPerCan: getOptionalNumber(formData, "gramsPerCan"),
      fat: getOptionalNumber(formData, "fat"),
      carbs: getOptionalNumber(formData, "carbs"),
      protein: getOptionalNumber(formData, "protein"),
      calories: getOptionalNumber(formData, "calories"),
      fiber: getOptionalNumber(formData, "fiber"),
      sugar: getOptionalNumber(formData, "sugar"),
      salt: getOptionalNumber(formData, "salt"),
    },
  });

  revalidatePath("/admin/ingredients");
}

export async function updateIngredient(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");
  const name = getRequiredString(formData, "name");
  const description = getOptionalString(formData, "description");
  const imageUrl = getOptionalString(formData, "imageUrl");

  await prisma.ingredient.update({
    where: { id },
    data: {
      name,
      description,
      imageUrl,
      mlDensityGPerMl: getOptionalNumber(formData, "mlDensityGPerMl"),
      gramsPerPiece: getOptionalNumber(formData, "gramsPerPiece"),
      gramsPerHand: getOptionalNumber(formData, "gramsPerHand"),
      gramsPerTeaspoon: getOptionalNumber(formData, "gramsPerTeaspoon"),
      gramsPerTablespoon: getOptionalNumber(formData, "gramsPerTablespoon"),
      gramsPerPinch: getOptionalNumber(formData, "gramsPerPinch"),
      gramsPerCup: getOptionalNumber(formData, "gramsPerCup"),
      gramsPerSlice: getOptionalNumber(formData, "gramsPerSlice"),
      gramsPerBunch: getOptionalNumber(formData, "gramsPerBunch"),
      gramsPerCan: getOptionalNumber(formData, "gramsPerCan"),
      fat: getOptionalNumber(formData, "fat"),
      carbs: getOptionalNumber(formData, "carbs"),
      protein: getOptionalNumber(formData, "protein"),
      calories: getOptionalNumber(formData, "calories"),
      fiber: getOptionalNumber(formData, "fiber"),
      sugar: getOptionalNumber(formData, "sugar"),
      salt: getOptionalNumber(formData, "salt"),
    },
  });

  await recomputeRecipeNutritionCachesByIngredientId(id);

  revalidatePath("/admin/ingredients");
}

export async function deleteIngredient(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");

  await recomputeRecipeNutritionCachesByIngredientId(id);

  await prisma.ingredient.delete({ where: { id } });

  revalidatePath("/admin/ingredients");
}
