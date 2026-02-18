import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function hasRequiredDelegates(client: PrismaClient) {
  const candidate = client as unknown as Record<string, unknown>;

  const hasFindFirstDelegate = (key: string) => {
    const delegate = candidate[key] as { findFirst?: unknown } | undefined;
    return Boolean(delegate && typeof delegate.findFirst === "function");
  };

  const hasCreateDelegate = (key: string) => {
    const delegate = candidate[key] as { create?: unknown } | undefined;
    return Boolean(delegate && typeof delegate.create === "function");
  };

  return (
    hasFindFirstDelegate("userPathEnrollment") &&
    hasFindFirstDelegate("userTrainingCalendarEntry") &&
    hasFindFirstDelegate("userNutritionCalendarEntry") &&
    hasFindFirstDelegate("userShoppingList") &&
    hasFindFirstDelegate("userSetting") &&
    hasFindFirstDelegate("userCoachProfile") &&
    hasFindFirstDelegate("userWeeklyCheckIn") &&
    hasFindFirstDelegate("dashboardInsightCache") &&
    hasFindFirstDelegate("userPairLink") &&
    hasFindFirstDelegate("userWorkoutSession") &&
    hasFindFirstDelegate("videoAsset") &&
    hasCreateDelegate("aIInteraction")
  );
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma =
  globalForPrisma.prisma && hasRequiredDelegates(globalForPrisma.prisma)
    ? globalForPrisma.prisma
    : createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
