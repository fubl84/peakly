import { requireAuth } from "@/lib/access";
import {
  buildSlotNutritionTarget,
  getSlotRecipeMatches,
} from "@/lib/nutrition-slot-matching";
import { resolveUserInfoBlocksForWeek } from "@/lib/info-blocks";
import { prisma } from "@/lib/prisma";
import { resolveAssignmentsForEnrollmentWeek } from "@/lib/variant-resolver";
import { resolveEnrollmentWeek } from "@/lib/week-resolver";
import Link from "next/link";
import { InfoBlockFeed } from "../../_components/info-block-feed";
import { PlannerWeekHeader } from "../../_components/planner-week-header";
import { NutritionPlannerClient } from "./nutrition-planner-client";

type SearchParamValue = string | string[] | undefined;

type NutritionPlannerPageProps = {
  searchParams?: Promise<Record<string, SearchParamValue>>;
};

type NutritionCalendarEntry = {
  id: string;
  dayOfWeek: number;
  mealType: string;
  recipeId: string | null;
  recipe: {
    id: string;
    name: string;
  } | null;
};

type RecipeOption = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  tips: string | null;
  variantOptionId: string | null;
  variantOption: {
    id: string;
    name: string;
  } | null;
  nutritionCalories: number | null;
  nutritionProtein: number | null;
  nutritionCarbs: number | null;
  nutritionFat: number | null;
  ingredients: {
    amount: number;
    unit: string;
    ingredient: {
      name: string;
    };
  }[];
  steps: {
    position: number;
    description: string;
  }[];
};

type NutritionAssignment = {
  contentRefId: string;
};

type BaseNutritionMealEntry = {
  mealType: string;
  amount: number;
  unit: string;
  ingredientId: string;
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
  nutritionPlan: {
    name: string;
  };
};

const DAY_LABELS = [
  { day: 1, label: "Montag" },
  { day: 2, label: "Dienstag" },
  { day: 3, label: "Mittwoch" },
  { day: 4, label: "Donnerstag" },
  { day: 5, label: "Freitag" },
  { day: 6, label: "Samstag" },
  { day: 7, label: "Sonntag" },
] as const;

const MEAL_SLOTS = [
  { value: "MORNING", label: "Morgens" },
  { value: "SNACK_1", label: "Snack 1" },
  { value: "LUNCH", label: "Mittag" },
  { value: "SNACK_2", label: "Snack 2" },
  { value: "DINNER", label: "Abend" },
  { value: "NIGHT", label: "Nacht" },
] as const;

function toSingle(value: SearchParamValue) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function clampWeek(week: number, maxWeek: number) {
  if (week < 1) return 1;
  if (week > maxWeek) return maxWeek;
  return week;
}

function entryKey(dayOfWeek: number, mealType: string) {
  return `${dayOfWeek}:${mealType}`;
}

function formatAmount(amount: number, unit: string) {
  return `${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(1)} ${unit}`;
}

function formatWeekDateRangeLabel(startDate: Date, week: number) {
  const weekStart = new Date(startDate);
  weekStart.setDate(weekStart.getDate() + (week - 1) * 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const formatter = new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
  });

  return `${formatter.format(weekStart)} - ${formatter.format(weekEnd)}`;
}

export default async function NutritionPlannerPage(
  props: NutritionPlannerPageProps,
) {
  const session = await requireAuth();
  const params = (await props.searchParams) ?? {};

  const enrollment = await prisma.userPathEnrollment.findFirst({
    where: { userId: session.user.id, isActive: true },
    include: {
      selectedVariants: {
        select: { variantOptionId: true },
      },
      path: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!enrollment) {
    return (
      <main className="dashboard-page">
        <h1 className="page-title">Ernährungsplaner</h1>
        <p>Keine aktive Teilnahme gefunden. Starte zuerst einen Pfad.</p>
        <Link className="back-link" href="/dashboard">
          Zurück zum Dashboard
        </Link>
      </main>
    );
  }

  const pathMaxWeek = await prisma.pathAssignment.aggregate({
    where: { pathId: enrollment.pathId },
    _max: { weekEnd: true },
  });

  const maxWeek = Math.max(pathMaxWeek._max.weekEnd ?? 1, 1);
  const currentEnrollmentWeek = resolveEnrollmentWeek({
    startDate: enrollment.startDate,
    maxWeeks: maxWeek,
  });

  const requestedWeek = Number.parseInt(toSingle(params.week), 10);
  const week = clampWeek(
    Number.isNaN(requestedWeek)
      ? currentEnrollmentWeek > 0
        ? currentEnrollmentWeek
        : 1
      : requestedWeek,
    maxWeek,
  );
  const currentWeek = clampWeek(
    currentEnrollmentWeek > 0 ? currentEnrollmentWeek : 1,
    maxWeek,
  );
  const weekDateRangeLabel = formatWeekDateRangeLabel(
    enrollment.startDate,
    week,
  );

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
    (assignment: NutritionAssignment) => assignment.contentRefId,
  );

  const baseMealEntries = assignedNutritionPlanIds.length
    ? ((await prisma.nutritionPlanMealEntry.findMany({
        where: { nutritionPlanId: { in: assignedNutritionPlanIds } },
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
          nutritionPlan: { select: { name: true } },
        },
        orderBy: [
          { mealType: "asc" },
          { nutritionPlan: { name: "asc" } },
          { ingredient: { name: "asc" } },
        ],
      })) as BaseNutritionMealEntry[])
    : [];

  const baseEntriesByMealSlot = new Map<string, BaseNutritionMealEntry[]>();
  for (const entry of baseMealEntries) {
    const list = baseEntriesByMealSlot.get(entry.mealType) ?? [];
    list.push(entry);
    baseEntriesByMealSlot.set(entry.mealType, list);
  }

  const plannedSlots = MEAL_SLOTS.filter((slot) =>
    baseEntriesByMealSlot.has(slot.value),
  );

  const slotTargetsByMealType = new Map<
    string,
    {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      warningCount: number;
      hasEstimatedConversions: boolean;
    }
  >();

  for (const slot of plannedSlots) {
    const entries = baseEntriesByMealSlot.get(slot.value) ?? [];
    if (!entries.length) {
      continue;
    }

    slotTargetsByMealType.set(slot.value, buildSlotNutritionTarget(entries));
  }

  const availableRecipes = (await prisma.recipe.findMany({
    where: {
      OR: [
        { variantOptionId: null },
        { variantOptionId: { in: selectedVariantOptionIds } },
      ],
    },
    orderBy: { name: "asc" },
    include: {
      variantOption: {
        select: {
          id: true,
          name: true,
        },
      },
      ingredients: {
        include: {
          ingredient: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          ingredient: {
            name: "asc",
          },
        },
      },
      steps: {
        select: {
          position: true,
          description: true,
        },
        orderBy: {
          position: "asc",
        },
      },
    },
  })) as RecipeOption[];

  const matchableRecipes = availableRecipes
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

  const slotMatchesByMealType = new Map<
    string,
    Array<{
      id: string;
      name: string;
      score: number;
      caloriesDiffPercent: number;
      proteinDiffPercent: number;
      carbsDiffPercent: number;
      fatDiffPercent: number;
    }>
  >();

  for (const slot of plannedSlots) {
    const target = slotTargetsByMealType.get(slot.value);
    if (!target) {
      continue;
    }

    slotMatchesByMealType.set(
      slot.value,
      getSlotRecipeMatches({
        target,
        recipes: matchableRecipes,
        limit: 5,
      }),
    );
  }

  const entries = (await prisma.userNutritionCalendarEntry.findMany({
    where: {
      enrollmentId: enrollment.id,
      week,
    },
    include: {
      recipe: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ dayOfWeek: "asc" }, { mealType: "asc" }],
  })) as NutritionCalendarEntry[];

  const entryByKey = new Map<string, NutritionCalendarEntry>(
    entries.map((entry: NutritionCalendarEntry) => [
      entryKey(entry.dayOfWeek, entry.mealType),
      entry,
    ]),
  );

  const dayCards = DAY_LABELS.map((day) => ({
    dayOfWeek: day.day,
    dayLabel: day.label,
    slots: plannedSlots.map((slot) => {
      const entry = entryByKey.get(entryKey(day.day, slot.value));
      const baseEntries = baseEntriesByMealSlot.get(slot.value) ?? [];

      return {
        mealType: slot.value,
        mealLabel: slot.label,
        selectedRecipeId: entry?.recipeId ?? null,
        selectedRecipeName: entry?.recipe?.name ?? null,
        targetNutrition: slotTargetsByMealType.get(slot.value) ?? null,
        recipeMatches: slotMatchesByMealType.get(slot.value) ?? [],
        baseIngredients: baseEntries.map((baseEntry) => ({
          label: `${baseEntry.ingredient.name} · ${formatAmount(baseEntry.amount, baseEntry.unit)}`,
        })),
      };
    }),
  }));

  const recipes = availableRecipes.map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    imageUrl: recipe.imageUrl,
    tips: recipe.tips,
    variantName: recipe.variantOption?.name ?? null,
    nutrition: {
      calories: recipe.nutritionCalories,
      protein: recipe.nutritionProtein,
      carbs: recipe.nutritionCarbs,
      fat: recipe.nutritionFat,
    },
    ingredients: recipe.ingredients.map(
      (entry) =>
        `${entry.ingredient.name} · ${formatAmount(entry.amount, entry.unit)}`,
    ),
    steps: recipe.steps.map((step) => step.description),
  }));

  const foodInfoBlocks = await resolveUserInfoBlocksForWeek({
    prismaClient: prisma,
    userId: session.user.id,
    pathId: enrollment.pathId,
    week,
    selectedVariantOptionIds,
    categories: ["FOOD"],
  });

  return (
    <main className="dashboard-page">
      {foodInfoBlocks.length > 0 ? (
        <InfoBlockFeed
          blocks={foodInfoBlocks}
          variant="banner"
          title="Food-Info"
        />
      ) : null}

      <h1 className="page-title">Ernährungsplaner</h1>
      <Link className="back-link" href="/dashboard">
        Zurück zum Dashboard
      </Link>

      <PlannerWeekHeader
        pathName="/dashboard/planner/nutrition"
        week={week}
        maxWeek={maxWeek}
        currentWeek={currentWeek}
        dateRangeLabel={weekDateRangeLabel}
        pathNameLabel={enrollment.path.name}
      />

      {assignedNutritionPlanIds.length === 0 ? (
        <section className="card stack">
          <h2 className="section-title">Ernährungskalender</h2>
          <p>Für diese Woche ist kein Ernährungsplan zugewiesen.</p>
        </section>
      ) : null}

      {assignedNutritionPlanIds.length > 0 && plannedSlots.length === 0 ? (
        <section className="card stack">
          <h2 className="section-title">Ernährungskalender</h2>
          <p>
            Für den zugewiesenen Ernährungsplan sind keine Mahlzeit-Einträge
            hinterlegt.
          </p>
        </section>
      ) : null}

      {plannedSlots.length > 0 ? (
        <NutritionPlannerClient
          week={week}
          dayCards={dayCards}
          recipes={recipes}
        />
      ) : null}
    </main>
  );
}
