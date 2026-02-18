import { requireAuth } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { resolveEnrollmentWeek } from "@/lib/week-resolver";
import Link from "next/link";
import {
  addManualShoppingItemAction,
  addRecipeIngredientsToShoppingListAction,
} from "./actions";
import { PlannerWeekHeader } from "../_components/planner-week-header";
import { ShoppingListClient } from "./shopping-list-client";

type SearchParamValue = string | string[] | undefined;

type ShoppingListPageProps = {
  searchParams?: Promise<Record<string, SearchParamValue>>;
};

type WeekRecipe = {
  id: string;
  name: string;
};

type ShoppingListItem = {
  id: string;
  label: string;
  amount: number | null;
  unit: string | null;
  isChecked: boolean;
  category: string;
  createdBy: {
    displayName: string | null;
    email: string;
  } | null;
};

type ActivePairLink = {
  id: string;
  initiatorId: string;
  inviteeId: string;
};

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

function formatAmount(amount: number | null, unit: string | null) {
  if (amount === null) {
    return null;
  }

  const rendered = Number.isInteger(amount)
    ? amount.toFixed(0)
    : amount.toFixed(1);
  return unit ? `${rendered} ${unit}` : rendered;
}

export default async function ShoppingListPage(props: ShoppingListPageProps) {
  const session = await requireAuth();
  const params = (await props.searchParams) ?? {};

  const activePairLink = (await prisma.userPairLink.findFirst({
    where: {
      status: "ACTIVE",
      OR: [{ initiatorId: session.user.id }, { inviteeId: session.user.id }],
    },
    select: {
      id: true,
      initiatorId: true,
      inviteeId: true,
      initiator: {
        select: {
          displayName: true,
          email: true,
        },
      },
      invitee: {
        select: {
          displayName: true,
          email: true,
        },
      },
    },
  })) as
    | (ActivePairLink & {
        initiator: { displayName: string | null; email: string };
        invitee: { displayName: string | null; email: string };
      })
    | null;

  const enrollment = await prisma.userPathEnrollment.findFirst({
    where: { userId: session.user.id, isActive: true },
    include: {
      path: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!enrollment) {
    return (
      <main className="dashboard-page">
        <h1 className="page-title">Einkaufsliste</h1>
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

  const selectedRecipeEntries =
    await prisma.userNutritionCalendarEntry.findMany({
      where: {
        enrollmentId: enrollment.id,
        week,
        recipeId: { not: null },
      },
      include: {
        recipe: {
          select: { id: true, name: true },
        },
      },
      orderBy: { recipeId: "asc" },
    });

  const selectedRecipesMap = new Map<string, WeekRecipe>();
  for (const entry of selectedRecipeEntries) {
    if (entry.recipe) {
      selectedRecipesMap.set(entry.recipe.id, entry.recipe);
    }
  }

  const selectedRecipes = Array.from(selectedRecipesMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "de"),
  );

  const listOwnerUserId = activePairLink
    ? activePairLink.initiatorId
    : session.user.id;
  const ownerEnrollment =
    listOwnerUserId === session.user.id
      ? enrollment
      : await prisma.userPathEnrollment.findFirst({
          where: { userId: listOwnerUserId, isActive: true },
          orderBy: { createdAt: "desc" },
        });

  const isSharedMode = Boolean(activePairLink);

  const shoppingList = ownerEnrollment
    ? await prisma.userShoppingList.findUnique({
        where: {
          enrollmentId_week: {
            enrollmentId: ownerEnrollment.id,
            week,
          },
        },
        include: {
          items: {
            orderBy: [{ isChecked: "asc" }, { label: "asc" }],
            select: {
              id: true,
              label: true,
              amount: true,
              unit: true,
              isChecked: true,
              category: true,
              createdBy: {
                select: {
                  displayName: true,
                  email: true,
                },
              },
            },
          },
        },
      })
    : null;

  const items = (shoppingList?.items ?? []) as ShoppingListItem[];
  const pairPartnerLabel = activePairLink
    ? activePairLink.initiatorId === session.user.id
      ? (activePairLink.invitee.displayName ?? activePairLink.invitee.email)
      : (activePairLink.initiator.displayName ?? activePairLink.initiator.email)
    : null;

  return (
    <main className="dashboard-page">
      <h1 className="page-title">Einkaufsliste</h1>
      <Link className="back-link" href="/dashboard">
        Zurück zum Dashboard
      </Link>

      <PlannerWeekHeader
        pathName="/dashboard/shopping-list"
        week={week}
        maxWeek={maxWeek}
        currentWeek={currentWeek}
        dateRangeLabel={weekDateRangeLabel}
        pathNameLabel={enrollment.path.name}
      />

      <section className="card stack">
        <h2 className="section-title">Manuellen Eintrag hinzufügen</h2>
        <form action={addManualShoppingItemAction} className="manual-item-form">
          <input type="hidden" name="week" value={week} />
          <input name="label" placeholder="z. B. Küchenpapier" required />
          <input
            name="amount"
            type="number"
            min="0"
            step="0.1"
            placeholder="Menge"
          />
          <input name="unit" placeholder="Einheit" />
          <button type="submit">Hinzufügen</button>
        </form>
      </section>

      <ShoppingListClient
        week={week}
        isSharedMode={isSharedMode}
        items={items.map((item) => ({
          id: item.id,
          label: item.label,
          amountLabel: formatAmount(item.amount, item.unit),
          isChecked: item.isChecked,
          category: item.category,
          createdByLabel: item.createdBy
            ? (item.createdBy.displayName ?? item.createdBy.email)
            : null,
        }))}
      />

      <section className="card stack">
        <h2 className="section-title">Aus Rezept hinzufügen</h2>
        <p className="muted">
          Für diese Woche ausgewählte Rezepte können als Zutaten gesammelt und
          aggregiert zur Einkaufsliste hinzugefügt werden.
        </p>

        {selectedRecipes.length === 0 ? (
          <p>
            In dieser Woche sind noch keine Rezepte im Ernährungsplaner
            ausgewählt.
          </p>
        ) : (
          <div className="stack">
            {selectedRecipes.map((recipe) => (
              <form
                key={recipe.id}
                action={addRecipeIngredientsToShoppingListAction}
                className="recipe-add-form"
              >
                <strong>{recipe.name}</strong>
                <input type="hidden" name="week" value={week} />
                <input type="hidden" name="recipeId" value={recipe.id} />
                <button type="submit">Zutaten hinzufügen</button>
              </form>
            ))}
          </div>
        )}
      </section>

      <section className="card stack">
        <div className="shopping-top-status-row">
          <p className="muted">Pairing wird in den Einstellungen verwaltet.</p>
          {isSharedMode ? (
            <span className="shopping-pair-badge">
              Gepaart mit {pairPartnerLabel}
            </span>
          ) : (
            <span className="shopping-pair-badge is-inactive">
              Nicht gepaart
            </span>
          )}
        </div>
        {isSharedMode ? (
          <p className="muted">
            Shared Mode aktiv: Änderungen werden auf der gemeinsamen Liste
            gespeichert.
          </p>
        ) : null}
      </section>
    </main>
  );
}
