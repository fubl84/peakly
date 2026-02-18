"use server";

import { assertAdminAction } from "@/lib/admin-action";
import {
  assertWeekRange,
  getOptionalNumber,
  getOptionalString,
  getRequiredInt,
  getRequiredString,
} from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

type MealSlotValue =
  | "MORNING"
  | "SNACK_1"
  | "LUNCH"
  | "SNACK_2"
  | "DINNER"
  | "NIGHT";
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

function parseMealSlot(value: string): MealSlotValue {
  if (
    value === "MORNING" ||
    value === "SNACK_1" ||
    value === "LUNCH" ||
    value === "SNACK_2" ||
    value === "DINNER" ||
    value === "NIGHT"
  ) {
    return value;
  }

  throw new Error("Ungültiger Mahlzeit-Slot.");
}

function parseAmountUnit(value: string): AmountUnitValue {
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

export async function createNutritionPlan(formData: FormData) {
  await assertAdminAction();

  const name = getRequiredString(formData, "name");
  const internalName = getRequiredString(
    formData,
    "internalName",
  ).toLowerCase();
  const description = getOptionalString(formData, "description");
  const weekStart = getRequiredInt(formData, "weekStart");
  const weekEnd = getRequiredInt(formData, "weekEnd");
  const variantOptionId = getOptionalString(formData, "variantOptionId");

  assertWeekRange(weekStart, weekEnd);

  await prisma.nutritionPlan.create({
    data: {
      name,
      internalName,
      description,
      weekStart,
      weekEnd,
      variantOptionId,
    },
  });

  revalidatePath("/admin/nutrition-plans");
}

export async function updateNutritionPlan(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");
  const name = getRequiredString(formData, "name");
  const internalName = getRequiredString(
    formData,
    "internalName",
  ).toLowerCase();
  const description = getOptionalString(formData, "description");
  const weekStart = getRequiredInt(formData, "weekStart");
  const weekEnd = getRequiredInt(formData, "weekEnd");
  const variantOptionId = getOptionalString(formData, "variantOptionId");

  assertWeekRange(weekStart, weekEnd);

  await prisma.nutritionPlan.update({
    where: { id },
    data: {
      name,
      internalName,
      description,
      weekStart,
      weekEnd,
      variantOptionId,
    },
  });

  revalidatePath("/admin/nutrition-plans");
}

export async function deleteNutritionPlan(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");

  await prisma.nutritionPlan.delete({ where: { id } });

  revalidatePath("/admin/nutrition-plans");
}

export async function createNutritionPlanMealEntry(formData: FormData) {
  await assertAdminAction();

  const nutritionPlanId = getRequiredString(formData, "nutritionPlanId");
  const mealType = parseMealSlot(getRequiredString(formData, "mealType"));
  const ingredientId = getRequiredString(formData, "ingredientId");
  const amount = getOptionalNumber(formData, "amount");
  const unit = parseAmountUnit(getRequiredString(formData, "unit"));

  if (amount === null || amount < 0) {
    throw new Error("Menge muss größer oder gleich 0 sein.");
  }

  await prisma.nutritionPlanMealEntry.create({
    data: {
      nutritionPlanId,
      mealType,
      ingredientId,
      amount,
      unit,
    },
  });

  revalidatePath("/admin/nutrition-plans");
}

export async function updateNutritionPlanMealEntry(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");
  const mealType = parseMealSlot(getRequiredString(formData, "mealType"));
  const ingredientId = getRequiredString(formData, "ingredientId");
  const amount = getOptionalNumber(formData, "amount");
  const unit = parseAmountUnit(getRequiredString(formData, "unit"));

  if (amount === null || amount <= 0) {
    throw new Error("Menge muss größer als 0 sein.");
  }

  await prisma.nutritionPlanMealEntry.update({
    where: { id },
    data: {
      mealType,
      ingredientId,
      amount,
      unit,
    },
  });

  revalidatePath("/admin/nutrition-plans");
}

export async function deleteNutritionPlanMealEntry(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");
  await prisma.nutritionPlanMealEntry.delete({ where: { id } });

  revalidatePath("/admin/nutrition-plans");
}
