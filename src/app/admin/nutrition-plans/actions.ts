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

async function buildUniqueNutritionInternalName(baseInternalName: string) {
  const sanitizedBase = baseInternalName.trim().toLowerCase();
  const baseCandidate = sanitizedBase
    ? `${sanitizedBase}-copy`
    : "nutrition-plan-copy";

  let candidate = baseCandidate;
  let index = 2;

  while (true) {
    const existing = await prisma.nutritionPlan.findUnique({
      where: { internalName: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${baseCandidate}-${index}`;
    index += 1;
  }
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
  const variantId = getOptionalString(formData, "variantId");
  const optionId = getOptionalString(formData, "optionId");

  assertWeekRange(weekStart, weekEnd);

  await prisma.nutritionPlan.create({
    data: {
      name,
      internalName,
      description,
      weekStart,
      weekEnd,
      variantId,
      optionId,
    },
  });

  revalidatePath("/admin/nutrition-plans");
}

export async function duplicateNutritionPlan(formData: FormData) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");

  const sourcePlan = await prisma.nutritionPlan.findUnique({
    where: { id },
  });

  if (!sourcePlan) {
    throw new Error("Ernährungsplan nicht gefunden.");
  }

  const sourceEntries = await prisma.nutritionPlanMealEntry.findMany({
    where: { nutritionPlanId: id },
    orderBy: [{ mealType: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      mealType: true,
      ingredientId: true,
      amount: true,
      unit: true,
    },
  });

  const sourceAlternatives =
    sourceEntries.length === 0
      ? []
      : await prisma.nutritionPlanMealEntryAlternative.findMany({
          where: {
            mealEntryId: {
              in: sourceEntries.map((entry) => entry.id),
            },
          },
          select: {
            mealEntryId: true,
            ingredientId: true,
          },
        });

  const internalName = await buildUniqueNutritionInternalName(
    sourcePlan.internalName,
  );

  await prisma.$transaction(async (tx) => {
    const duplicatedPlan = await tx.nutritionPlan.create({
      data: {
        name: `${sourcePlan.name} (Kopie)`,
        internalName,
        description: sourcePlan.description,
        weekStart: sourcePlan.weekStart,
        weekEnd: sourcePlan.weekEnd,
        variantId: sourcePlan.variantId,
        optionId: sourcePlan.optionId,
      },
    });

    const duplicatedMealEntryIds = new Map<string, string>();

    for (const entry of sourceEntries) {
      const duplicatedEntry = await tx.nutritionPlanMealEntry.create({
        data: {
          nutritionPlanId: duplicatedPlan.id,
          mealType: entry.mealType,
          ingredientId: entry.ingredientId,
          amount: entry.amount,
          unit: entry.unit,
        },
      });

      duplicatedMealEntryIds.set(entry.id, duplicatedEntry.id);
    }

    const alternativeRows = sourceAlternatives
      .map((alternative) => {
        const duplicatedMealEntryId = duplicatedMealEntryIds.get(
          alternative.mealEntryId,
        );

        if (!duplicatedMealEntryId) {
          return null;
        }

        return {
          mealEntryId: duplicatedMealEntryId,
          ingredientId: alternative.ingredientId,
        };
      })
      .filter(
        (value): value is { mealEntryId: string; ingredientId: string } =>
          value !== null,
      );

    if (alternativeRows.length > 0) {
      await tx.nutritionPlanMealEntryAlternative.createMany({
        data: alternativeRows,
      });
    }
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
  const variantId = getOptionalString(formData, "variantId");
  const optionId = getOptionalString(formData, "optionId");

  assertWeekRange(weekStart, weekEnd);

  await prisma.nutritionPlan.update({
    where: { id },
    data: {
      name,
      internalName,
      description,
      weekStart,
      weekEnd,
      variantId,
      optionId,
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

export async function createNutritionPlanMealEntryAlternative(
  formData: FormData,
) {
  await assertAdminAction();

  const mealEntryId = getRequiredString(formData, "mealEntryId");
  const ingredientId = getRequiredString(formData, "ingredientId");

  const mealEntry = await prisma.nutritionPlanMealEntry.findUnique({
    where: { id: mealEntryId },
    select: { ingredientId: true },
  });

  if (!mealEntry) {
    throw new Error("Mahlzeit-Eintrag nicht gefunden.");
  }

  if (mealEntry.ingredientId === ingredientId) {
    throw new Error(
      "Primäre Zutat kann nicht als Alternative hinterlegt werden.",
    );
  }

  await prisma.nutritionPlanMealEntryAlternative.create({
    data: {
      mealEntryId,
      ingredientId,
    },
  });

  revalidatePath("/admin/nutrition-plans");
}

export async function deleteNutritionPlanMealEntryAlternative(
  formData: FormData,
) {
  await assertAdminAction();

  const id = getRequiredString(formData, "id");

  await prisma.nutritionPlanMealEntryAlternative.delete({ where: { id } });

  revalidatePath("/admin/nutrition-plans");
}
