-- CreateEnum
CREATE TYPE "CoachTone" AS ENUM ('SUPPORTIVE', 'DIRECT', 'PERFORMANCE', 'ANALYTICAL');

-- CreateEnum
CREATE TYPE "WeeklyCheckInType" AS ENUM ('MONDAY_PLAN', 'SUNDAY_RECAP');

-- CreateEnum
CREATE TYPE "DashboardInsightKey" AS ENUM ('TODAY_FOCUS', 'GOAL_FEEDBACK', 'PLAN_SYNC', 'MOMENTUM');

-- CreateTable
CREATE TABLE "UserCoachProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tone" "CoachTone" NOT NULL DEFAULT 'SUPPORTIVE',
    "constraints" TEXT,
    "trainingPreferences" TEXT,
    "nutritionPreferences" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCoachProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserWeeklyCheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "year" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "type" "WeeklyCheckInType" NOT NULL,
    "energyLevel" INTEGER,
    "stressLevel" INTEGER,
    "sleepQualityLevel" INTEGER,
    "adherenceLevel" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWeeklyCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardInsightCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enrollmentId" TEXT,
    "week" INTEGER NOT NULL,
    "insightKey" "DashboardInsightKey" NOT NULL,
    "content" TEXT NOT NULL,
    "contextHash" TEXT NOT NULL,
    "model" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardInsightCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCoachProfile_userId_key" ON "UserCoachProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserWeeklyCheckIn_userId_year_week_type_key" ON "UserWeeklyCheckIn"("userId", "year", "week", "type");

-- CreateIndex
CREATE INDEX "UserWeeklyCheckIn_userId_year_week_idx" ON "UserWeeklyCheckIn"("userId", "year", "week");

-- CreateIndex
CREATE INDEX "UserWeeklyCheckIn_enrollmentId_idx" ON "UserWeeklyCheckIn"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardInsightCache_userId_week_insightKey_key" ON "DashboardInsightCache"("userId", "week", "insightKey");

-- CreateIndex
CREATE INDEX "DashboardInsightCache_userId_expiresAt_idx" ON "DashboardInsightCache"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "DashboardInsightCache_enrollmentId_week_idx" ON "DashboardInsightCache"("enrollmentId", "week");

-- AddForeignKey
ALTER TABLE "UserCoachProfile" ADD CONSTRAINT "UserCoachProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWeeklyCheckIn" ADD CONSTRAINT "UserWeeklyCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWeeklyCheckIn" ADD CONSTRAINT "UserWeeklyCheckIn_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "UserPathEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardInsightCache" ADD CONSTRAINT "DashboardInsightCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardInsightCache" ADD CONSTRAINT "DashboardInsightCache_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "UserPathEnrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
