"use server";

import { assertAdminAction } from "@/lib/admin-action";
import {
  getOptionalNumber,
  getOptionalString,
  getRequiredString,
} from "@/lib/forms";
import { recomputeRecipeNutritionCache } from "@/lib/nutrition-cache";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type AmountUnitValue =
  | "G"
  | "ML"
  | "L"
  | "KG"
  | "EL"
  | "TL"
  | "HAND"
  | "STK"
  | "PRISE"
  | "TASSE"
  | "SCHEIBE"
  | "BUND"
  | "DOSE";

function parseAmountUnit(valueRaw: string | null): AmountUnitValue {
  const value = String(valueRaw ?? "").trim();
  if (
    value === "G" ||
    value === "ML" ||
    value === "L" ||
    value === "KG" ||
    value === "EL" ||
    value === "TL" ||
    value === "HAND" ||
    value === "STK" ||
    value === "PRISE" ||
    value === "TASSE" ||
    value === "SCHEIBE" ||
    value === "BUND" ||
    value === "DOSE"
  ) {
    return value;
  }

  throw new Error("Ungültige Einheit.");
}

export async function createRecipe(formData: FormData) {
  await assertAdminAction();

  const name = getRequiredString(formData, "name");
  const internalName = getRequiredString(
    formData,
    "internalName",
  ).toLowerCase();
  const description = getOptionalString(formData, "description");
  const imageUrl = getOptionalString(formData, "imageUrl");
  const tips = getOptionalString(formData, "tips");
  const variantOptionId = getOptionalString(formData, "variantOptionId");

  const recipe = await prisma.recipe.create({
    data: { name, internalName, description, imageUrl, tips, variantOptionId },
  });

  await recomputeRecipeNutritionCache(recipe.id);

  revalidatePath("/admin/recipes");
}

export async function createRecipeIngredient(formData: FormData) {
  await assertAdminAction();

  const recipeId = getRequiredString(formData, "recipeId");
  const ingredientId = getRequiredString(formData, "ingredientId");
  const amountRaw = getOptionalNumber(formData, "amount");
  const amount = amountRaw ?? 0;
  const unit = parseAmountUnit(formData.get("unit")?.toString() ?? "G");

  if (amount < 0) {
    throw new Error("Menge muss größer oder gleich 0 sein.");
  }

  await prisma.recipeIngredient.create({
    data: {
      recipeId,
      ingredientId,
      amount,
      unit,
    },
  });

  await recomputeRecipeNutritionCache(recipeId);
  revalidatePath("/admin/recipes");
}

export async function updateRecipeIngredient(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");
  const ingredientId = getRequiredString(formData, "ingredientId");
  const amountRaw = getOptionalNumber(formData, "amount");
  const amount = amountRaw ?? 0;
  const unit = parseAmountUnit(formData.get("unit")?.toString() ?? "G");

  if (amount < 0) {
    throw new Error("Menge muss größer oder gleich 0 sein.");
  }

  const updated = await prisma.recipeIngredient.update({
    where: { id },
    data: {
      ingredientId,
      amount,
      unit,
    },
    select: { recipeId: true },
  });

  await recomputeRecipeNutritionCache(updated.recipeId);
  revalidatePath("/admin/recipes");
}

export async function deleteRecipeIngredient(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");

  const deleted = await prisma.recipeIngredient.delete({
    where: { id },
    select: { recipeId: true },
  });

  await recomputeRecipeNutritionCache(deleted.recipeId);
  revalidatePath("/admin/recipes");
}

export async function createRecipeStep(formData: FormData) {
  await assertAdminAction();

  const recipeId = getRequiredString(formData, "recipeId");
  const description = getRequiredString(formData, "description");

  const lastStep = await prisma.recipeStep.findFirst({
    where: { recipeId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.recipeStep.create({
    data: {
      recipeId,
      description,
      position: (lastStep?.position ?? 0) + 1,
    },
  });

  revalidatePath("/admin/recipes");
}

export async function updateRecipeStep(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");
  const description = getRequiredString(formData, "description");

  await prisma.recipeStep.update({
    where: { id },
    data: { description },
  });

  revalidatePath("/admin/recipes");
}

export async function deleteRecipeStep(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");

  const deleted = await prisma.recipeStep.delete({
    where: { id },
    select: { recipeId: true },
  });

  const remaining = await prisma.recipeStep.findMany({
    where: { recipeId: deleted.recipeId },
    orderBy: { position: "asc" },
    select: { id: true },
  });

  await prisma.$transaction(
    remaining.map((step: { id: string }, index: number) =>
      prisma.recipeStep.update({
        where: { id: step.id },
        data: { position: index + 1 },
      }),
    ),
  );

  revalidatePath("/admin/recipes");
}

export async function reorderRecipeSteps(formData: FormData) {
  await assertAdminAction();

  const recipeId = getRequiredString(formData, "recipeId");
  const orderedStepIdsRaw = getRequiredString(formData, "orderedStepIds");

  let orderedStepIds: string[];
  try {
    const parsed: unknown = JSON.parse(orderedStepIdsRaw);
    if (
      !Array.isArray(parsed) ||
      parsed.some((value) => typeof value !== "string")
    ) {
      throw new Error();
    }
    orderedStepIds = parsed;
  } catch {
    throw new Error("Ungültige Reihenfolge übergeben.");
  }

  const existing = await prisma.recipeStep.findMany({
    where: { recipeId },
    orderBy: { position: "asc" },
    select: { id: true },
  });

  if (existing.length !== orderedStepIds.length) {
    throw new Error("Die Reihenfolge passt nicht zu den aktuellen Schritten.");
  }

  const existingIds = new Set(existing.map((step: { id: string }) => step.id));
  if (orderedStepIds.some((id) => !existingIds.has(id))) {
    throw new Error("Die Reihenfolge enthält ungültige Schritte.");
  }

  await prisma.$transaction(
    orderedStepIds.map((id, index) =>
      prisma.recipeStep.update({
        where: { id },
        data: { position: index + 1 },
      }),
    ),
  );

  revalidatePath("/admin/recipes");
}

export async function updateRecipe(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");
  const name = getRequiredString(formData, "name");
  const internalName = getRequiredString(
    formData,
    "internalName",
  ).toLowerCase();
  const description = getOptionalString(formData, "description");
  const imageUrl = getOptionalString(formData, "imageUrl");
  const tips = getOptionalString(formData, "tips");
  const variantOptionId = getOptionalString(formData, "variantOptionId");

  await prisma.recipe.update({
    where: { id },
    data: { name, internalName, description, imageUrl, tips, variantOptionId },
  });

  await recomputeRecipeNutritionCache(id);

  revalidatePath("/admin/recipes");
}

export async function deleteRecipe(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");

  await prisma.recipe.delete({ where: { id } });

  revalidatePath("/admin/recipes");
}
