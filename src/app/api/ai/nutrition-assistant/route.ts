import { auth } from "@/auth";
import { generateGeminiText } from "@/lib/ai/gemini";
import {
  buildSlotNutritionTarget,
  getSlotRecipeMatches,
} from "@/lib/nutrition-slot-matching";
import {
  beginApiRequest,
  completeApiRequest,
  withRequestIdHeader,
} from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { resolveAssignmentsForEnrollmentWeek } from "@/lib/variant-resolver";
import { NextResponse } from "next/server";

type NutritionAssignment = {
  contentRefId: string;
};

type SlotBaseEntry = {
  mealType: string;
  amount: number;
  unit: string;
  ingredient: {
    id: string;
    name: string;
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

type SelectedRecipeEntry = {
  dayOfWeek: number;
  mealType: string;
  recipe: {
    name: string;
  } | null;
};

type AllowedRecipe = {
  id: string;
  name: string;
  nutritionCalories: number | null;
  nutritionProtein: number | null;
  nutritionCarbs: number | null;
  nutritionFat: number | null;
};

function normalizeWeek(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function formatAmount(amount: number, unit: string) {
  return `${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(1)} ${unit}`;
}

export async function POST(request: Request) {
  const ctx = beginApiRequest(request, "/api/ai/nutrition-assistant");
  const session = await auth();
  const userId = session?.user?.id;

  const respond = (response: NextResponse, errorMessage?: string) => {
    completeApiRequest({
      ctx,
      status: response.status,
      userId,
      errorMessage,
    });
    return withRequestIdHeader(response, ctx.requestId);
  };

  if (!userId) {
    return respond(
      NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 }),
      "Nicht angemeldet.",
    );
  }

  try {
    const body = (await request.json()) as {
      week?: unknown;
      mealType?: unknown;
      note?: unknown;
    };

    const week = normalizeWeek(body.week);
    const mealType = normalizeText(body.mealType);
    const note = normalizeText(body.note);

    if (!week) {
      return respond(
        NextResponse.json({ error: "Ungültige Woche." }, { status: 400 }),
        "Ungültige Woche.",
      );
    }

    const enrollment = await prisma.userPathEnrollment.findFirst({
      where: { userId, isActive: true },
      include: {
        selectedVariants: {
          select: { variantOptionId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!enrollment) {
      return respond(
        NextResponse.json(
          { error: "Keine aktive Teilnahme gefunden." },
          { status: 400 },
        ),
        "Keine aktive Teilnahme gefunden.",
      );
    }

    const selectedVariantOptionIds = enrollment.selectedVariants.map(
      (entry: { variantOptionId: string }) => entry.variantOptionId,
    );

    const nutritionAssignments = (await resolveAssignmentsForEnrollmentWeek({
      prismaClient: prisma,
      pathId: enrollment.pathId,
      week,
      selectedVariantOptionIds,
      kind: "NUTRITION",
    })) as NutritionAssignment[];

    const assignedNutritionPlanIds = nutritionAssignments.map(
      (assignment) => assignment.contentRefId,
    );

    const slotBaseEntries = assignedNutritionPlanIds.length
      ? await prisma.nutritionPlanMealEntry.findMany({
          where: {
            nutritionPlanId: { in: assignedNutritionPlanIds },
            ...(mealType ? { mealType } : {}),
          },
          include: {
            ingredient: {
              select: {
                id: true,
                name: true,
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
          orderBy: [{ mealType: "asc" }, { ingredient: { name: "asc" } }],
          take: 180,
        })
      : [];

    const selectedRecipes = (await prisma.userNutritionCalendarEntry.findMany({
      where: {
        enrollmentId: enrollment.id,
        week,
        recipeId: { not: null },
      },
      include: {
        recipe: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }],
      take: 80,
    })) as SelectedRecipeEntry[];

    const allowedRecipes = (await prisma.recipe.findMany({
      where: {
        OR: [
          { variantOptionId: null },
          { variantOptionId: { in: selectedVariantOptionIds } },
        ],
      },
      select: {
        id: true,
        name: true,
        nutritionCalories: true,
        nutritionProtein: true,
        nutritionCarbs: true,
        nutritionFat: true,
      },
      orderBy: { name: "asc" },
      take: 30,
    })) as AllowedRecipe[];

    const slotBaseContext = (slotBaseEntries as SlotBaseEntry[])
      .map(
        (entry: SlotBaseEntry) =>
          `${entry.mealType}: ${entry.ingredient.name} (${formatAmount(entry.amount, entry.unit)})`,
      )
      .join("\n");

    const groupedSlotEntries = new Map<string, SlotBaseEntry[]>();
    for (const entry of slotBaseEntries as SlotBaseEntry[]) {
      const list = groupedSlotEntries.get(entry.mealType) ?? [];
      list.push(entry);
      groupedSlotEntries.set(entry.mealType, list);
    }

    const matchableRecipes = (allowedRecipes as AllowedRecipe[])
      .filter(
        (recipe) =>
          recipe.nutritionCalories !== null &&
          recipe.nutritionProtein !== null &&
          recipe.nutritionCarbs !== null &&
          recipe.nutritionFat !== null,
      )
      .map((recipe) => ({
        id: recipe.id,
        name: recipe.name,
        calories: recipe.nutritionCalories as number,
        protein: recipe.nutritionProtein as number,
        carbs: recipe.nutritionCarbs as number,
        fat: recipe.nutritionFat as number,
      }));

    const matchContexts = Array.from(groupedSlotEntries.entries())
      .map(([slot, entries]) => {
        const target = buildSlotNutritionTarget(entries);
        const matches = getSlotRecipeMatches({
          target,
          recipes: matchableRecipes,
          limit: 3,
        });

        const matchLines = matches
          .map(
            (match) =>
              `- ${match.name} (kcal Δ${match.caloriesDiffPercent.toFixed(1)}%, P Δ${match.proteinDiffPercent.toFixed(1)}%, KH Δ${match.carbsDiffPercent.toFixed(1)}%, F Δ${match.fatDiffPercent.toFixed(1)}%)`,
          )
          .join("\n");

        return [
          `${slot}: Ziel ${target.calories.toFixed(1)} kcal · P ${target.protein.toFixed(1)} · KH ${target.carbs.toFixed(1)} · F ${target.fat.toFixed(1)}`,
          matchLines
            ? `Passende Rezepte:\n${matchLines}`
            : "Passende Rezepte: keine",
        ].join("\n");
      })
      .join("\n\n");

    const selectedRecipeContext = selectedRecipes
      .map(
        (entry: SelectedRecipeEntry) =>
          `Tag ${entry.dayOfWeek} / ${entry.mealType}: ${entry.recipe?.name ?? "ohne Rezept"}`,
      )
      .join("\n");

    const allowedRecipeContext = allowedRecipes
      .map((recipe: AllowedRecipe) => `- ${recipe.name}`)
      .join("\n");

    const prompt = [
      "Du bist ein deutschsprachiger Ernährungs-Coach in einer Fitness-App.",
      "Ziel: Hilf dem Nutzer mit konkreten, kurzen Empfehlungen für Mahlzeit- oder Zutatenersatz auf Basis ähnlicher Nährwerte (ohne Chat-Historie).",
      "Antwortvorgabe:",
      "- Nur Deutsch",
      "- 4 bis 8 Sätze",
      "- Positiv, konkret, alltagstauglich",
      "- Wenn sinnvoll, 2-3 konkrete Rezeptideen aus den passenden Rezepten nennen",
      "- Bei Zutatenersatz: nenne praktikable Alternativen und kurze Mengenhinweise",
      mealType ? `Fokus-Mahlzeit-Slot: ${mealType}` : null,
      `Woche: ${week}`,
      note
        ? `Nutzerfrage: ${note}`
        : "Nutzerfrage: Bitte gib mir eine sinnvolle Wochenempfehlung.",
      slotBaseContext
        ? `Basis-Slots (Zutaten je Slot):\n${slotBaseContext}`
        : "Basis-Slots: keine Daten",
      selectedRecipeContext
        ? `Bereits ausgewählte Rezepte:\n${selectedRecipeContext}`
        : "Bereits ausgewählte Rezepte: keine",
      allowedRecipeContext
        ? `Erlaubte Rezepte (Auswahl):\n${allowedRecipeContext}`
        : "Erlaubte Rezepte: keine",
      matchContexts
        ? `Deterministische Nährwert-Matches je Slot:\n${matchContexts}`
        : "Deterministische Nährwert-Matches: keine",
    ].join("\n\n");

    const message = (await generateGeminiText({ prompt, userId }))
      .trim()
      .slice(0, 2000);

    await prisma.aIInteraction.create({
      data: {
        userId,
        type: "NUTRITION_ASSISTANT",
        request: JSON.stringify({ week, mealType, note }).slice(0, 4000),
        response: message,
      },
    });

    return respond(
      NextResponse.json({
        data: {
          message,
        },
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unbekannter Nutrition-AI-Fehler";

    await prisma.aIInteraction.create({
      data: {
        userId,
        type: "NUTRITION_ASSISTANT_ERROR",
        request: "POST /api/ai/nutrition-assistant",
        error: message,
      },
    });

    return respond(
      NextResponse.json({ error: message }, { status: 500 }),
      message,
    );
  }
}
