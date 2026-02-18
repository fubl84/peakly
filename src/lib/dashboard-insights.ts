import { generateGeminiText } from "@/lib/ai/gemini";
import { resolveUserInfoBlocksForWeek } from "@/lib/info-blocks";
import {
  buildSlotNutritionTarget,
  getSlotRecipeMatches,
} from "@/lib/nutrition-slot-matching";
import { prisma } from "@/lib/prisma";
import { resolveUserWeekBundle } from "@/lib/user-runtime";
import { resolveAssignmentsForEnrollmentWeek } from "@/lib/variant-resolver";
import { createHash } from "crypto";

const CACHE_TTL_HOURS = 12;

type CoachTone = "SUPPORTIVE" | "DIRECT" | "PERFORMANCE" | "ANALYTICAL";
type WeeklyCheckInType = "MONDAY_PLAN" | "SUNDAY_RECAP";
type DashboardInsightKey =
  | "TODAY_FOCUS"
  | "GOAL_FEEDBACK"
  | "PLAN_SYNC"
  | "MOMENTUM";

type DashboardInsightCacheRecord = {
  content: string;
  contextHash: string;
  generatedAt: Date;
  expiresAt: Date;
};

type WeeklyCheckInMinimal = {
  type: WeeklyCheckInType;
  note: string | null;
};

const prismaWithDashboard = prisma as unknown as {
  userCoachProfile: {
    findUnique: (args: unknown) => Promise<{ tone: CoachTone } | null>;
  };
  userWeeklyCheckIn: {
    findMany: (args: unknown) => Promise<WeeklyCheckInMinimal[]>;
  };
  dashboardInsightCache: {
    findUnique: (args: unknown) => Promise<DashboardInsightCacheRecord | null>;
    upsert: (args: unknown) => Promise<unknown>;
  };
};

const INSIGHT_KEYS = [
  "TODAY_FOCUS",
  "GOAL_FEEDBACK",
  "PLAN_SYNC",
  "MOMENTUM",
] as const;

const MEAL_LABELS: Record<string, string> = {
  BREAKFAST: "Frühstück",
  LUNCH: "Mittagessen",
  DINNER: "Abendessen",
  SNACK: "Snack",
};

const DAY_LABELS = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
] as const;

const INSIGHT_TITLES: Record<DashboardInsightKey, string> = {
  TODAY_FOCUS: "Heute im Fokus",
  GOAL_FEEDBACK: "Ziel-Feedback",
  PLAN_SYNC: "Plan-Integration",
  MOMENTUM: "Momentum",
};

const TONE_GUIDANCE: Record<CoachTone, string> = {
  SUPPORTIVE: "Warm, ermutigend und lösungsorientiert.",
  DIRECT: "Direkt, klar und ohne Floskeln.",
  PERFORMANCE: "Leistungsorientiert, ambitioniert und fordernd.",
  ANALYTICAL: "Ruhig, strukturiert und analytisch-präzise.",
};

type ShoppingProgressItem = { isChecked: boolean };

type WorkoutSessionSummary = {
  dayOfWeek: number;
  status: "ACTIVE" | "COMPLETED";
};

type TrainingWeekEntry = {
  isRestDay: boolean;
  trainingPlanId: string | null;
};

type TodayNutritionEntry = {
  mealType: string;
  recipe: { name: string } | null;
};

type BaseNutritionMealEntryForMatching = {
  mealType: string;
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

type MatchableRecipe = {
  id: string;
  name: string;
  nutritionCalories: number | null;
  nutritionProtein: number | null;
  nutritionCarbs: number | null;
  nutritionFat: number | null;
};

type CheckInPromptState = {
  isoYear: number;
  isoWeek: number;
  shouldAskMondayPlan: boolean;
  shouldAskSundayRecap: boolean;
};

type DashboardInsightCard = {
  key: DashboardInsightKey;
  title: string;
  content: string;
  generatedAt: string;
  expiresAt: string;
  fromCache: boolean;
};

export type DashboardInsightsResult = {
  week: number;
  maxWeek: number;
  pathName: string;
  cards: DashboardInsightCard[];
  checkInPrompt: CheckInPromptState;
};

function dayIndexFromDate(date: Date) {
  return ((date.getDay() + 6) % 7) + 1;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function toIsoWeekParts(date: Date) {
  const copy = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const day = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((copy.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );

  return {
    isoYear: copy.getUTCFullYear(),
    isoWeek: week,
  };
}

function sanitizeInsightText(value: string) {
  const compact = value
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

  const withoutGreeting = compact.replace(
    /^(hallo|hi|hey|guten\s+(morgen|tag|abend)|servus|moin)\b[\s,!:.-]*/i,
    "",
  );

  const sentenceChunks = withoutGreeting
    .split(/(?<=[.!?])\s+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return sentenceChunks.slice(0, 4).join(" ").slice(0, 680);
}

function stripHtml(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPrompt(args: {
  insightKey: DashboardInsightKey;
  tone: CoachTone;
  goal: string | null;
  week: number;
  maxWeek: number;
  pathName: string;
  todayLabel: string;
  todayTrainingName: string | null;
  todayMealPlanSummary: string;
  todayRecipeSuggestionSummary: string;
  contextualInfoNotes: string[];
  pathProgress: number;
  workoutCompleted: number;
  workoutPlanned: number;
  shoppingDone: number;
  shoppingTotal: number;
  activeSessionDayLabel: string | null;
  daysSinceStart: number;
  mondayCheckInNote: string | null;
  sundayRecapNote: string | null;
}) {
  const focusByKey: Record<DashboardInsightKey, string> = {
    TODAY_FOCUS:
      "Formuliere einen präzisen Fokus für heute mit 1-3 direkt ausführbaren Schritten.",
    GOAL_FEEDBACK:
      "Interpretiere den Fortschritt Richtung Ziel nachvollziehbar und mit konkreten Zahlenbezugen.",
    PLAN_SYNC:
      "Bewerte, wie gut Training, Ernährung und Einkauf gerade zusammenspielen, und nenne Engpässe.",
    MOMENTUM:
      "Stärke Konstanz und Momentum mit einem klaren Next-Best-Step für die nächsten 24 Stunden.",
  };

  const goalText = args.goal?.trim()
    ? args.goal.trim()
    : "kein explizites Freitext-Ziel hinterlegt";
  const infoBlockText =
    args.contextualInfoNotes.length > 0
      ? args.contextualInfoNotes.join(" | ")
      : "keine passenden Info-Block-Hinweise";

  return [
    "Du bist ein persönlicher Fitness- und Ernährungscoach in einer App.",
    "Sprache: ausschließlich Deutsch.",
    `Tonfall: ${TONE_GUIDANCE[args.tone]}`,
    "Schreibe NICHT generisch. Beziehe dich auf konkrete Daten und Namen.",
    "Nutze mindestens zwei konkrete Zahlen aus dem Kontext.",
    "Länge: 2 bis 4 Sätze, kompakt und konkret.",
    "Beginne OHNE Begrüßung (kein Hallo/Hi/Guten Morgen).",
    "Kein medizinischer Rat.",
    `Modus: ${focusByKey[args.insightKey]}`,
    "",
    "Kontext:",
    `- Pfad: ${args.pathName}`,
    `- Woche: ${args.week}/${args.maxWeek}`,
    `- Ziel (Freitext): ${goalText}`,
    `- Heute: ${args.todayLabel}`,
    `- Heutiges Training: ${args.todayTrainingName ?? "kein Training geplant"}`,
    `- Heutiger Meal-Plan: ${args.todayMealPlanSummary}`,
    `- Rezept-Alternativen für heute: ${args.todayRecipeSuggestionSummary}`,
    `- Relevante Info-Block Hinweise: ${infoBlockText}`,
    `- Pfad-Fortschritt: ${formatPercent(args.pathProgress)}`,
    `- Workout-Fortschritt: ${args.workoutCompleted}/${args.workoutPlanned}`,
    `- Einkauf erledigt: ${args.shoppingDone}/${args.shoppingTotal}`,
    `- Aktive Session: ${args.activeSessionDayLabel ?? "keine aktive Session"}`,
    `- Tage seit Start: ${args.daysSinceStart}`,
    `- Monday-Check-In Notiz: ${args.mondayCheckInNote ?? "keine"}`,
    `- Sunday-Recap Notiz: ${args.sundayRecapNote ?? "keine"}`,
    "",
    "Antwort: genau ein zusammenhängender Abschnitt, keine Aufzählung.",
  ].join("\n");
}

async function resolveCheckInPromptState(userId: string, now: Date) {
  const { isoYear, isoWeek } = toIsoWeekParts(now);

  const entries = await prismaWithDashboard.userWeeklyCheckIn.findMany({
    where: {
      userId,
      year: isoYear,
      week: isoWeek,
      type: {
        in: ["MONDAY_PLAN", "SUNDAY_RECAP"],
      },
    },
    select: { type: true },
  });

  const hasMondayPlan = entries.some((entry) => entry.type === "MONDAY_PLAN");
  const hasSundayRecap = entries.some((entry) => entry.type === "SUNDAY_RECAP");

  const weekday = dayIndexFromDate(now);

  return {
    isoYear,
    isoWeek,
    shouldAskMondayPlan: weekday === 1 && !hasMondayPlan,
    shouldAskSundayRecap: weekday === 7 && !hasSundayRecap,
  } satisfies CheckInPromptState;
}

export async function getDashboardInsightsForUser(args: {
  userId: string;
  forceRefresh?: boolean;
}) {
  const forceRefresh = args.forceRefresh ?? false;
  const now = new Date();

  const bundle = await resolveUserWeekBundle(args.userId);
  if (!bundle) {
    throw new Error("Keine aktive Teilnahme gefunden.");
  }

  const todayIndex = dayIndexFromDate(now);
  const todayLabel = DAY_LABELS[todayIndex - 1] ?? "Heute";
  const isoParts = toIsoWeekParts(now);

  const [
    settings,
    coachProfile,
    todayTrainingEntry,
    todayNutritionEntries,
    shoppingListWeek,
    workoutSessionsWeek,
    trainingWeekEntries,
    checkInPrompt,
    latestCheckIns,
    nutritionAssignments,
    availableRecipes,
    baseMealEntries,
    weeklyInfoBlocks,
  ] = await Promise.all([
    prisma.userSetting.findUnique({
      where: { userId: args.userId },
      select: { pathGoal: true },
    }),
    prismaWithDashboard.userCoachProfile.findUnique({
      where: { userId: args.userId },
      select: { tone: true },
    }),
    prisma.userTrainingCalendarEntry.findUnique({
      where: {
        enrollmentId_week_dayOfWeek: {
          enrollmentId: bundle.enrollment.id,
          week: bundle.week,
          dayOfWeek: todayIndex,
        },
      },
      include: {
        trainingPlan: {
          select: { name: true },
        },
      },
    }),
    prisma.userNutritionCalendarEntry.findMany({
      where: {
        enrollmentId: bundle.enrollment.id,
        week: bundle.week,
        dayOfWeek: todayIndex,
      },
      include: {
        recipe: {
          select: { name: true },
        },
      },
      orderBy: { mealType: "asc" },
    }) as Promise<TodayNutritionEntry[]>,
    prisma.userShoppingList.findUnique({
      where: {
        enrollmentId_week: {
          enrollmentId: bundle.enrollment.id,
          week: bundle.week,
        },
      },
      include: {
        items: {
          select: { isChecked: true },
        },
      },
    }),
    prisma.userWorkoutSession.findMany({
      where: {
        enrollmentId: bundle.enrollment.id,
        week: bundle.week,
      },
      select: {
        dayOfWeek: true,
        status: true,
      },
    }) as Promise<WorkoutSessionSummary[]>,
    prisma.userTrainingCalendarEntry.findMany({
      where: {
        enrollmentId: bundle.enrollment.id,
        week: bundle.week,
      },
      select: {
        isRestDay: true,
        trainingPlanId: true,
      },
    }) as Promise<TrainingWeekEntry[]>,
    resolveCheckInPromptState(args.userId, now),
    prismaWithDashboard.userWeeklyCheckIn.findMany({
      where: {
        userId: args.userId,
        year: {
          in: [isoParts.isoYear, isoParts.isoYear - 1],
        },
      },
      orderBy: [{ year: "desc" }, { week: "desc" }, { createdAt: "desc" }],
      take: 8,
      select: {
        type: true,
        note: true,
      },
    }),
    resolveAssignmentsForEnrollmentWeek({
      prismaClient: prisma,
      pathId: bundle.enrollment.pathId,
      week: bundle.week,
      selectedVariantOptionIds: bundle.enrollment.selectedVariants.map(
        (entry) => entry.variantOptionId,
      ),
      kind: "NUTRITION",
    }),
    prisma.recipe.findMany({
      where: {
        OR: [
          { variantOptionId: null },
          {
            variantOptionId: {
              in: bundle.enrollment.selectedVariants.map(
                (entry) => entry.variantOptionId,
              ),
            },
          },
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
      take: 300,
    }) as Promise<MatchableRecipe[]>,
    prisma.nutritionPlanMealEntry.findMany({
      where: {
        nutritionPlanId: {
          in: [],
        },
      },
      include: {
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
    }) as Promise<BaseNutritionMealEntryForMatching[]>,
    resolveUserInfoBlocksForWeek({
      prismaClient: prisma,
      userId: args.userId,
      pathId: bundle.enrollment.pathId,
      week: bundle.week,
      selectedVariantOptionIds: bundle.enrollment.selectedVariants.map(
        (entry) => entry.variantOptionId,
      ),
      categories: ["GENERAL", "MOTIVATION", "FOOD", "WORKOUT"],
    }),
  ]);

  const assignedNutritionPlanIds = Array.from(
    new Set(
      nutritionAssignments
        .map((assignment: { contentRefId: string }) => assignment.contentRefId)
        .filter(Boolean),
    ),
  );

  const effectiveBaseMealEntries = assignedNutritionPlanIds.length
    ? ((await prisma.nutritionPlanMealEntry.findMany({
        where: {
          nutritionPlanId: {
            in: assignedNutritionPlanIds,
          },
        },
        include: {
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
      })) as BaseNutritionMealEntryForMatching[])
    : baseMealEntries;

  const checkedItems =
    shoppingListWeek?.items.filter(
      (item: ShoppingProgressItem) => item.isChecked,
    ).length ?? 0;
  const totalItems = shoppingListWeek?.items.length ?? 0;
  const completedSessions = workoutSessionsWeek.filter(
    (entry) => entry.status === "COMPLETED",
  ).length;
  const activeSession = workoutSessionsWeek.find(
    (entry) => entry.status === "ACTIVE",
  );
  const plannedTrainingDays = trainingWeekEntries.filter(
    (entry) => Boolean(entry.trainingPlanId) && !entry.isRestDay,
  ).length;
  const daysSinceStart = Math.max(
    0,
    Math.floor(
      (now.getTime() - bundle.enrollment.startDate.getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );
  const pathProgress =
    bundle.maxWeek > 0 ? Math.min(bundle.week / bundle.maxWeek, 1) : 0;

  const mondayCheckIn = latestCheckIns.find(
    (entry) => entry.type === "MONDAY_PLAN",
  );
  const sundayCheckIn = latestCheckIns.find(
    (entry) => entry.type === "SUNDAY_RECAP",
  );

  const todayMealSummaryEntries = todayNutritionEntries.map((entry) => {
    const label = MEAL_LABELS[entry.mealType] ?? entry.mealType;
    if (entry.recipe?.name) {
      return `${label}: Rezept ${entry.recipe.name}`;
    }

    return `${label}: Basisplan aktiv`;
  });

  const openMealTypes = Array.from(
    new Set(
      todayNutritionEntries
        .filter((entry) => !entry.recipe)
        .map((entry) => entry.mealType),
    ),
  );

  const baseEntriesByMealType = new Map<
    string,
    BaseNutritionMealEntryForMatching[]
  >();
  for (const entry of effectiveBaseMealEntries) {
    const list = baseEntriesByMealType.get(entry.mealType) ?? [];
    list.push(entry);
    baseEntriesByMealType.set(entry.mealType, list);
  }

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

  const suggestionEntries: string[] = [];
  for (const mealType of openMealTypes) {
    const slotEntries = baseEntriesByMealType.get(mealType) ?? [];
    if (!slotEntries.length) {
      continue;
    }

    const target = buildSlotNutritionTarget(slotEntries);
    const match = getSlotRecipeMatches({
      target,
      recipes: matchableRecipes,
      limit: 1,
    })[0];

    if (!match) {
      continue;
    }

    suggestionEntries.push(
      `${MEAL_LABELS[mealType] ?? mealType}: ${match.name}`,
    );
  }

  const infoBlockContext = weeklyInfoBlocks
    .map((block) => ({
      category: block.category,
      text: `${block.name}: ${stripHtml(block.contentHtml).slice(0, 160)}`,
    }))
    .filter((entry) => entry.text.length > 3);

  const infoCategoryMap: Record<DashboardInsightKey, string[]> = {
    TODAY_FOCUS: ["WORKOUT", "GENERAL"],
    GOAL_FEEDBACK: ["MOTIVATION", "GENERAL"],
    PLAN_SYNC: ["FOOD", "WORKOUT", "GENERAL"],
    MOMENTUM: ["MOTIVATION", "GENERAL"],
  };

  const contextBase = {
    goal: settings?.pathGoal ?? null,
    tone: coachProfile?.tone ?? "SUPPORTIVE",
    week: bundle.week,
    maxWeek: bundle.maxWeek,
    pathName: bundle.enrollment.path.name,
    todayLabel,
    todayTrainingName: todayTrainingEntry?.trainingPlan?.name ?? null,
    todayMealPlanSummary:
      todayMealSummaryEntries.length > 0
        ? todayMealSummaryEntries.join(" | ")
        : "keine Meal-Slots im heutigen Plan",
    todayRecipeSuggestionSummary:
      suggestionEntries.length > 0
        ? suggestionEntries.join(" | ")
        : "keine passende Rezept-Alternative im Bestand gefunden",
    pathProgress,
    workoutCompleted: completedSessions,
    workoutPlanned: plannedTrainingDays,
    shoppingDone: checkedItems,
    shoppingTotal: totalItems,
    activeSessionDayLabel: activeSession
      ? (DAY_LABELS[activeSession.dayOfWeek - 1] ?? null)
      : null,
    daysSinceStart,
    mondayCheckInNote: mondayCheckIn?.note ?? null,
    sundayRecapNote: sundayCheckIn?.note ?? null,
  };

  const cards: DashboardInsightCard[] = [];

  for (const insightKey of INSIGHT_KEYS) {
    const contextualInfoNotes = infoBlockContext
      .filter((entry) => infoCategoryMap[insightKey].includes(entry.category))
      .slice(0, 2)
      .map((entry) => entry.text);

    const cardContext = {
      ...contextBase,
      insightKey,
      contextualInfoNotes,
    };

    const contextHash = createHash("sha256")
      .update(JSON.stringify(cardContext))
      .digest("hex");

    const existing = await prismaWithDashboard.dashboardInsightCache.findUnique(
      {
        where: {
          userId_week_insightKey: {
            userId: args.userId,
            week: bundle.week,
            insightKey,
          },
        },
        select: {
          content: true,
          contextHash: true,
          generatedAt: true,
          expiresAt: true,
        },
      },
    );

    const stillValid =
      Boolean(existing) &&
      !forceRefresh &&
      existing?.contextHash === contextHash &&
      existing.expiresAt.getTime() > now.getTime();

    if (stillValid && existing) {
      cards.push({
        key: insightKey,
        title: INSIGHT_TITLES[insightKey],
        content: existing.content,
        generatedAt: existing.generatedAt.toISOString(),
        expiresAt: existing.expiresAt.toISOString(),
        fromCache: true,
      });
      continue;
    }

    const prompt = buildPrompt({
      ...contextBase,
      insightKey,
      contextualInfoNotes,
    });
    const generatedText = await generateGeminiText({
      prompt,
      userId: args.userId,
    });

    const generatedAt = new Date();
    const expiresAt = new Date(
      generatedAt.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000,
    );
    const content = sanitizeInsightText(generatedText);

    await prismaWithDashboard.dashboardInsightCache.upsert({
      where: {
        userId_week_insightKey: {
          userId: args.userId,
          week: bundle.week,
          insightKey,
        },
      },
      create: {
        userId: args.userId,
        enrollmentId: bundle.enrollment.id,
        week: bundle.week,
        insightKey,
        content,
        contextHash,
        model: process.env.GEMINI_MODEL?.trim() || null,
        generatedAt,
        expiresAt,
      },
      update: {
        enrollmentId: bundle.enrollment.id,
        content,
        contextHash,
        model: process.env.GEMINI_MODEL?.trim() || null,
        generatedAt,
        expiresAt,
      },
    });

    cards.push({
      key: insightKey,
      title: INSIGHT_TITLES[insightKey],
      content,
      generatedAt: generatedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      fromCache: false,
    });
  }

  return {
    week: bundle.week,
    maxWeek: bundle.maxWeek,
    pathName: bundle.enrollment.path.name,
    cards,
    checkInPrompt,
  } satisfies DashboardInsightsResult;
}
