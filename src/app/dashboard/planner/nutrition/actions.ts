"use server";

import { auth } from "@/auth";
import {
  getOptionalString,
  getRequiredInt,
  getRequiredString,
} from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { resolveAssignmentsForEnrollmentWeek } from "@/lib/variant-resolver";
import { revalidatePath } from "next/cache";

type SessionLike = {
  user?: {
    id?: string;
    role?: string;
    email?: string | null;
  };
} | null;

type MealSlotValue =
  | "MORNING"
  | "SNACK_1"
  | "LUNCH"
  | "SNACK_2"
  | "DINNER"
  | "NIGHT";

type NutritionAssignment = {
  contentRefId: string;
};

type SlotIngredientRow = {
  amount: number;
  unit: string;
  ingredientId: string;
  ingredient: {
    id: string;
    name: string;
  };
};

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

function assertDayOfWeek(dayOfWeek: number) {
  if (dayOfWeek < 1 || dayOfWeek > 7) {
    throw new Error("Tag muss zwischen 1 und 7 liegen.");
  }
}

function resolveSession(args?: { session?: SessionLike }) {
  if (args && "session" in args) {
    return Promise.resolve(args.session ?? null);
  }

  return auth() as Promise<SessionLike>;
}

function assertWeek(week: number) {
  if (week < 1) {
    throw new Error("Woche muss größer oder gleich 1 sein.");
  }
}

async function resolveEnrollmentForWeek(userId: string, week: number) {
  const enrollment = await prisma.userPathEnrollment.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (!enrollment) {
    throw new Error("Keine aktive Teilnahme gefunden.");
  }

  const pathMaxWeek = await prisma.pathAssignment.aggregate({
    where: { pathId: enrollment.pathId },
    _max: { weekEnd: true },
  });

  const maxWeek = pathMaxWeek._max.weekEnd ?? 1;
  if (week > maxWeek) {
    throw new Error("Woche liegt außerhalb der Pfaddauer.");
  }

  return enrollment;
}

async function getActivePairLinkForUser(userId: string) {
  return prisma.userPairLink.findFirst({
    where: {
      status: "ACTIVE",
      OR: [{ initiatorId: userId }, { inviteeId: userId }],
    },
    select: {
      id: true,
      initiatorId: true,
      inviteeId: true,
    },
  });
}

async function resolveSharedListOwnerEnrollmentForWeek(
  userId: string,
  week: number,
) {
  const activePairLink = await getActivePairLinkForUser(userId);
  const ownerUserId = activePairLink ? activePairLink.initiatorId : userId;
  const ownerEnrollment = await resolveEnrollmentForWeek(ownerUserId, week);

  return {
    ownerUserId,
    ownerEnrollment,
  };
}

async function getOrCreateShoppingList(args: {
  userId: string;
  enrollmentId: string;
  week: number;
}) {
  return prisma.userShoppingList.upsert({
    where: {
      enrollmentId_week: {
        enrollmentId: args.enrollmentId,
        week: args.week,
      },
    },
    create: {
      userId: args.userId,
      enrollmentId: args.enrollmentId,
      week: args.week,
    },
    update: {},
  });
}

export async function upsertNutritionCalendarEntryAction(
  formData: FormData,
  args?: { session?: SessionLike; skipRevalidate?: boolean },
) {
  const session =
    args && "session" in args
      ? (args.session ?? null)
      : ((await auth()) as SessionLike);

  if (!session?.user?.id) {
    throw new Error("Nicht angemeldet.");
  }

  const week = getRequiredInt(formData, "week");
  const dayOfWeek = getRequiredInt(formData, "dayOfWeek");
  const mealType = parseMealSlot(getRequiredString(formData, "mealType"));
  const recipeId = getOptionalString(formData, "recipeId");

  if (week < 1) {
    throw new Error("Woche muss größer oder gleich 1 sein.");
  }

  assertDayOfWeek(dayOfWeek);

  const enrollment = await prisma.userPathEnrollment.findFirst({
    where: { userId: session.user.id, isActive: true },
    include: {
      selectedVariants: {
        select: { variantOptionId: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!enrollment) {
    throw new Error("Keine aktive Teilnahme gefunden.");
  }

  const pathMaxWeek = await prisma.pathAssignment.aggregate({
    where: { pathId: enrollment.pathId },
    _max: { weekEnd: true },
  });

  const maxWeek = pathMaxWeek._max.weekEnd ?? 1;
  if (week > maxWeek) {
    throw new Error("Woche liegt außerhalb der Pfaddauer.");
  }

  const selectedVariantOptionIds = enrollment.selectedVariants.map(
    (entry: { variantOptionId: string }) => entry.variantOptionId,
  );

  const nutritionAssignments = await resolveAssignmentsForEnrollmentWeek({
    prismaClient: prisma,
    pathId: enrollment.pathId,
    week,
    selectedVariantOptionIds,
    kind: "NUTRITION",
  });

  if (nutritionAssignments.length === 0) {
    throw new Error("Für diese Woche ist kein Ernährungsplan zugewiesen.");
  }

  const assignedNutritionPlanIds = nutritionAssignments.map(
    (assignment: NutritionAssignment) => assignment.contentRefId,
  );

  const baseSlotEntryCount = await prisma.nutritionPlanMealEntry.count({
    where: {
      nutritionPlanId: { in: assignedNutritionPlanIds },
      mealType,
    },
  });

  if (baseSlotEntryCount === 0) {
    throw new Error(
      "Dieser Mahlzeit-Slot ist in deinem Ernährungsplan für diese Woche nicht vorgesehen.",
    );
  }

  if (recipeId) {
    const recipe = await prisma.recipe.findFirst({
      where: {
        id: recipeId,
        OR: [
          { variantOptionId: null },
          { variantOptionId: { in: selectedVariantOptionIds } },
        ],
      },
      select: { id: true },
    });

    if (!recipe) {
      throw new Error(
        "Das Rezept ist für deine aktuelle Varianten-Auswahl nicht verfügbar.",
      );
    }
  }

  await prisma.userNutritionCalendarEntry.upsert({
    where: {
      enrollmentId_week_dayOfWeek_mealType: {
        enrollmentId: enrollment.id,
        week,
        dayOfWeek,
        mealType,
      },
    },
    create: {
      userId: session.user.id,
      enrollmentId: enrollment.id,
      week,
      dayOfWeek,
      mealType,
      recipeId,
    },
    update: {
      recipeId,
    },
  });

  if (!args?.skipRevalidate) {
    revalidatePath("/dashboard/planner/nutrition");
  }
}

export async function addNutritionSlotIngredientsToShoppingListAction(
  formData: FormData,
  args?: { session?: SessionLike; skipRevalidate?: boolean },
) {
  const session = await resolveSession(args);

  if (!session?.user?.id) {
    throw new Error("Nicht angemeldet.");
  }

  const week = getRequiredInt(formData, "week");
  const dayOfWeek = getRequiredInt(formData, "dayOfWeek");
  const mealType = parseMealSlot(getRequiredString(formData, "mealType"));

  assertWeek(week);
  assertDayOfWeek(dayOfWeek);

  const actorEnrollment = await prisma.userPathEnrollment.findFirst({
    where: { userId: session.user.id, isActive: true },
    include: {
      selectedVariants: {
        select: { variantOptionId: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!actorEnrollment) {
    throw new Error("Keine aktive Teilnahme gefunden.");
  }

  const selectedVariantOptionIds = actorEnrollment.selectedVariants.map(
    (entry: { variantOptionId: string }) => entry.variantOptionId,
  );

  const sharedListContext = await resolveSharedListOwnerEnrollmentForWeek(
    session.user.id,
    week,
  );

  const selectedEntry = await prisma.userNutritionCalendarEntry.findFirst({
    where: {
      enrollmentId: actorEnrollment.id,
      week,
      dayOfWeek,
      mealType,
    },
    select: {
      recipeId: true,
    },
  });

  const ingredients = await (async () => {
    if (selectedEntry?.recipeId) {
      return (await prisma.recipeIngredient.findMany({
        where: { recipeId: selectedEntry.recipeId },
        include: {
          ingredient: {
            select: { id: true, name: true },
          },
        },
      })) as SlotIngredientRow[];
    }

    const nutritionAssignments = await resolveAssignmentsForEnrollmentWeek({
      prismaClient: prisma,
      pathId: actorEnrollment.pathId,
      week,
      selectedVariantOptionIds,
      kind: "NUTRITION",
    });

    if (nutritionAssignments.length === 0) {
      throw new Error("Für diese Woche ist kein Ernährungsplan zugewiesen.");
    }

    const assignedNutritionPlanIds = nutritionAssignments.map(
      (assignment: NutritionAssignment) => assignment.contentRefId,
    );

    return (await prisma.nutritionPlanMealEntry.findMany({
      where: {
        nutritionPlanId: { in: assignedNutritionPlanIds },
        mealType,
      },
      include: {
        ingredient: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })) as SlotIngredientRow[];
  })();

  if (ingredients.length === 0) {
    throw new Error("Für diesen Slot sind keine Zutaten verfügbar.");
  }

  const shoppingList = await getOrCreateShoppingList({
    userId: sharedListContext.ownerUserId,
    enrollmentId: sharedListContext.ownerEnrollment.id,
    week,
  });

  await prisma.$transaction(
    ingredients.map((entry) => {
      const dedupeKey = `ingredient:${entry.ingredientId}:${entry.unit.toLowerCase()}`;

      return prisma.userShoppingListItem.upsert({
        where: {
          shoppingListId_dedupeKey: {
            shoppingListId: shoppingList.id,
            dedupeKey,
          },
        },
        create: {
          shoppingListId: shoppingList.id,
          dedupeKey,
          label: entry.ingredient.name,
          ingredientId: entry.ingredient.id,
          sourceRecipeId: selectedEntry?.recipeId ?? null,
          amount: entry.amount,
          unit: entry.unit,
        },
        update: {
          amount: {
            increment: entry.amount,
          },
          label: entry.ingredient.name,
          ingredientId: entry.ingredient.id,
          ...(selectedEntry?.recipeId
            ? {
                sourceRecipeId: selectedEntry.recipeId,
              }
            : {}),
        },
      });
    }),
  );

  if (!args?.skipRevalidate) {
    revalidatePath("/dashboard/planner/nutrition");
    revalidatePath("/dashboard/shopping-list");
  }
}
