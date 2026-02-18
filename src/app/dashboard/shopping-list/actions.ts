"use server";

import { auth } from "@/auth";
import {
  getOptionalNumber,
  getOptionalString,
  getRequiredInt,
  getRequiredString,
} from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { resolveShoppingCategory } from "@/lib/shopping-categories";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

type RecipeIngredientRow = {
  amount: number;
  unit: string;
  ingredientId: string;
  ingredient: {
    id: string;
    name: string;
  };
};

type ShoppingItemRow = {
  id: string;
  dedupeKey: string;
  label: string;
  amount: number | null;
  unit: string | null;
  isChecked: boolean;
  ingredientId: string | null;
  sourceRecipeId: string | null;
  createdByUserId: string | null;
};

type ActivePairLink = {
  id: string;
  initiatorId: string;
  inviteeId: string;
};

type SessionLike = {
  user?: {
    id?: string;
    role?: string;
    email?: string | null;
  };
} | null;

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

function getPairPartnerUserId(pairLink: ActivePairLink, userId: string) {
  return pairLink.initiatorId === userId
    ? pairLink.inviteeId
    : pairLink.initiatorId;
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
    activePairLink,
  };
}

async function assertCanAccessShoppingListOwner(args: {
  actorUserId: string;
  listOwnerUserId: string;
}) {
  if (args.actorUserId === args.listOwnerUserId) {
    return;
  }

  const activePairLink = await getActivePairLinkForUser(args.actorUserId);
  if (!activePairLink) {
    throw new Error("Kein Zugriff auf diese Einkaufsliste.");
  }

  const partnerUserId = getPairPartnerUserId(activePairLink, args.actorUserId);
  if (partnerUserId !== args.listOwnerUserId) {
    throw new Error("Kein Zugriff auf diese Einkaufsliste.");
  }
}

export async function createPairInviteAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Nicht angemeldet.");
  }

  const inviteeEmail = getRequiredString(
    formData,
    "inviteeEmail",
  ).toLowerCase();

  const invitee = await prisma.user.findUnique({
    where: { email: inviteeEmail },
    select: { id: true },
  });

  if (!invitee) {
    throw new Error("Benutzer mit dieser E-Mail nicht gefunden.");
  }

  if (invitee.id === session.user.id) {
    throw new Error("Du kannst dich nicht selbst einladen.");
  }

  const existingActiveForInitiator = await getActivePairLinkForUser(
    session.user.id,
  );
  if (existingActiveForInitiator) {
    throw new Error("Du hast bereits eine aktive Pair-Verbindung.");
  }

  const existingActiveForInvitee = await getActivePairLinkForUser(invitee.id);
  if (existingActiveForInvitee) {
    throw new Error(
      "Der eingeladene Benutzer hat bereits eine aktive Pair-Verbindung.",
    );
  }

  const existingPending = await prisma.userPairLink.findFirst({
    where: {
      status: "PENDING",
      OR: [
        { initiatorId: session.user.id, inviteeId: invitee.id },
        { initiatorId: invitee.id, inviteeId: session.user.id },
      ],
    },
    select: { id: true },
  });

  if (!existingPending) {
    await prisma.userPairLink.create({
      data: {
        pairKey: randomUUID(),
        initiatorId: session.user.id,
        inviteeId: invitee.id,
      },
    });
  }

  revalidatePath("/dashboard/shopping-list");
  revalidatePath("/dashboard/settings");
}

export async function acceptPairInviteAction(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("Nicht angemeldet.");
  }

  const pairKey = getRequiredString(formData, "pairKey");

  const pendingInvite = await prisma.userPairLink.findUnique({
    where: { pairKey },
    select: {
      id: true,
      initiatorId: true,
      inviteeId: true,
      status: true,
    },
  });

  if (!pendingInvite || pendingInvite.status !== "PENDING") {
    throw new Error("Einladung nicht gefunden.");
  }

  if (pendingInvite.inviteeId !== session.user.id) {
    throw new Error("Du darfst diese Einladung nicht annehmen.");
  }

  const existingActiveForInvitee = await getActivePairLinkForUser(
    session.user.id,
  );
  if (existingActiveForInvitee) {
    throw new Error("Du hast bereits eine aktive Pair-Verbindung.");
  }

  const existingActiveForInitiator = await getActivePairLinkForUser(
    pendingInvite.initiatorId,
  );
  if (existingActiveForInitiator) {
    throw new Error("Der Einladende hat bereits eine aktive Pair-Verbindung.");
  }

  await prisma.userPairLink.update({
    where: { id: pendingInvite.id },
    data: {
      status: "ACTIVE",
      acceptedAt: new Date(),
    },
  });

  revalidatePath("/dashboard/shopping-list");
  revalidatePath("/dashboard/settings");
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

export async function addManualShoppingItemAction(
  formData: FormData,
  args?: { session?: SessionLike; skipRevalidate?: boolean },
) {
  const session = await resolveSession(args);

  if (!session?.user?.id) {
    throw new Error("Nicht angemeldet.");
  }

  const userId = session.user.id;

  const week = getRequiredInt(formData, "week");
  const label = getRequiredString(formData, "label");
  const amount = getOptionalNumber(formData, "amount");
  const unit = getOptionalString(formData, "unit");

  assertWeek(week);

  if (amount !== null && amount <= 0) {
    throw new Error("Menge muss größer als 0 sein.");
  }

  const sharedListContext = await resolveSharedListOwnerEnrollmentForWeek(
    userId,
    week,
  );

  const shoppingList = await getOrCreateShoppingList({
    userId: sharedListContext.ownerUserId,
    enrollmentId: sharedListContext.ownerEnrollment.id,
    week,
  });

  await prisma.userShoppingListItem.create({
    data: {
      shoppingListId: shoppingList.id,
      dedupeKey: `manual:${randomUUID()}`,
      label,
      category: resolveShoppingCategory(label),
      createdByUserId: userId,
      amount,
      unit,
    },
  });

  if (!args?.skipRevalidate) {
    revalidatePath("/dashboard/shopping-list");
  }
}

function normalizeCleanupLabel(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

function normalizeCleanupUnit(unit: string | null) {
  if (!unit) {
    return "";
  }

  return unit.trim().toLowerCase();
}

function resolveCleanupMergeKey(item: ShoppingItemRow) {
  const normalizedLabel = normalizeCleanupLabel(item.label);
  const normalizedUnit = normalizeCleanupUnit(item.unit);
  return `${normalizedLabel}::${normalizedUnit}`;
}

export async function applyShoppingListCleanupAction(
  formData: FormData,
  args?: { session?: SessionLike; skipRevalidate?: boolean },
) {
  const session = await resolveSession(args);

  if (!session?.user?.id) {
    throw new Error("Nicht angemeldet.");
  }

  const week = getRequiredInt(formData, "week");
  assertWeek(week);

  const sharedListContext = await resolveSharedListOwnerEnrollmentForWeek(
    session.user.id,
    week,
  );

  const shoppingList = await prisma.userShoppingList.findUnique({
    where: {
      enrollmentId_week: {
        enrollmentId: sharedListContext.ownerEnrollment.id,
        week,
      },
    },
    include: {
      items: {
        orderBy: [{ isChecked: "asc" }, { label: "asc" }],
        select: {
          id: true,
          dedupeKey: true,
          label: true,
          amount: true,
          unit: true,
          isChecked: true,
          ingredientId: true,
          sourceRecipeId: true,
          createdByUserId: true,
        },
      },
    },
  });

  if (!shoppingList || shoppingList.items.length === 0) {
    return;
  }

  const groups = new Map<string, ShoppingItemRow[]>();
  for (const item of shoppingList.items as ShoppingItemRow[]) {
    const key = resolveCleanupMergeKey(item);
    const existing = groups.get(key) ?? [];
    existing.push(item);
    groups.set(key, existing);
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const groupItems of groups.values()) {
      if (groupItems.length === 0) {
        continue;
      }

      const [first, ...rest] = groupItems;
      const allAmountsAvailable = groupItems.every(
        (entry) => entry.amount !== null,
      );
      const mergedAmount = allAmountsAvailable
        ? groupItems.reduce((sum, entry) => sum + (entry.amount ?? 0), 0)
        : null;
      const anyChecked = groupItems.some((entry) => entry.isChecked);

      await tx.userShoppingListItem.update({
        where: { id: first.id },
        data: {
          amount: mergedAmount,
          isChecked: anyChecked,
          category: resolveShoppingCategory(first.label),
        },
      });

      if (rest.length > 0) {
        await tx.userShoppingListItem.deleteMany({
          where: {
            id: {
              in: rest.map((entry) => entry.id),
            },
          },
        });
      }
    }
  });

  if (!args?.skipRevalidate) {
    revalidatePath("/dashboard/shopping-list");
  }
}

export async function addRecipeIngredientsToShoppingListAction(
  formData: FormData,
  args?: { session?: SessionLike; skipRevalidate?: boolean },
) {
  const session = await resolveSession(args);

  if (!session?.user?.id) {
    throw new Error("Nicht angemeldet.");
  }

  const userId = session.user.id;

  const week = getRequiredInt(formData, "week");
  const recipeId = getRequiredString(formData, "recipeId");

  assertWeek(week);

  const actorEnrollment = await resolveEnrollmentForWeek(userId, week);
  const sharedListContext = await resolveSharedListOwnerEnrollmentForWeek(
    userId,
    week,
  );

  const selectedEntry = await prisma.userNutritionCalendarEntry.findFirst({
    where: {
      enrollmentId: actorEnrollment.id,
      week,
      recipeId,
    },
    select: { id: true },
  });

  if (!selectedEntry) {
    throw new Error(
      "Das Rezept ist in dieser Woche nicht im Ernährungsplaner ausgewählt.",
    );
  }

  const recipeIngredients = await prisma.recipeIngredient.findMany({
    where: { recipeId },
    include: {
      ingredient: {
        select: { id: true, name: true },
      },
    },
  });

  if (recipeIngredients.length === 0) {
    throw new Error("Das Rezept enthält keine Zutaten.");
  }

  const shoppingList = await getOrCreateShoppingList({
    userId: sharedListContext.ownerUserId,
    enrollmentId: sharedListContext.ownerEnrollment.id,
    week,
  });

  await prisma.$transaction(
    recipeIngredients.map((entry: RecipeIngredientRow) => {
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
          category: resolveShoppingCategory(entry.ingredient.name),
          createdByUserId: userId,
          ingredientId: entry.ingredient.id,
          sourceRecipeId: recipeId,
          amount: entry.amount,
          unit: entry.unit,
        },
        update: {
          amount: {
            increment: entry.amount,
          },
          label: entry.ingredient.name,
          category: resolveShoppingCategory(entry.ingredient.name),
          ingredientId: entry.ingredient.id,
        },
      });
    }),
  );

  if (!args?.skipRevalidate) {
    revalidatePath("/dashboard/shopping-list");
  }
}

export async function toggleShoppingListItemAction(
  formData: FormData,
  args?: { session?: SessionLike; skipRevalidate?: boolean },
) {
  const session = await resolveSession(args);

  if (!session?.user?.id) {
    throw new Error("Nicht angemeldet.");
  }

  const itemId = getRequiredString(formData, "itemId");

  const item = await prisma.userShoppingListItem.findFirst({
    where: {
      id: itemId,
    },
    select: {
      id: true,
      isChecked: true,
      shoppingList: {
        select: { userId: true },
      },
    },
  });

  if (!item) {
    throw new Error("Eintrag nicht gefunden.");
  }

  await assertCanAccessShoppingListOwner({
    actorUserId: session.user.id,
    listOwnerUserId: item.shoppingList.userId,
  });

  await prisma.userShoppingListItem.update({
    where: { id: item.id },
    data: { isChecked: !item.isChecked },
  });

  if (!args?.skipRevalidate) {
    revalidatePath("/dashboard/shopping-list");
  }
}

export async function deleteShoppingListItemAction(
  formData: FormData,
  args?: { session?: SessionLike; skipRevalidate?: boolean },
) {
  const session = await resolveSession(args);

  if (!session?.user?.id) {
    throw new Error("Nicht angemeldet.");
  }

  const itemId = getRequiredString(formData, "itemId");

  const item = await prisma.userShoppingListItem.findFirst({
    where: {
      id: itemId,
    },
    select: {
      id: true,
      shoppingList: {
        select: { userId: true },
      },
    },
  });

  if (!item) {
    throw new Error("Eintrag nicht gefunden.");
  }

  await assertCanAccessShoppingListOwner({
    actorUserId: session.user.id,
    listOwnerUserId: item.shoppingList.userId,
  });

  await prisma.userShoppingListItem.delete({
    where: { id: item.id },
  });

  if (!args?.skipRevalidate) {
    revalidatePath("/dashboard/shopping-list");
  }
}
