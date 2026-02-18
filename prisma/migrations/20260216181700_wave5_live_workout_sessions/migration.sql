-- CreateEnum
CREATE TYPE "WorkoutSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateTable
CREATE TABLE "UserWorkoutSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "trainingPlanId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "currentStepIndex" INTEGER NOT NULL DEFAULT 0,
    "status" "WorkoutSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserWorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserWorkoutSession_userId_week_status_idx" ON "UserWorkoutSession"("userId", "week", "status");

-- CreateIndex
CREATE INDEX "UserWorkoutSession_enrollmentId_week_dayOfWeek_idx" ON "UserWorkoutSession"("enrollmentId", "week", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "UserWorkoutSession" ADD CONSTRAINT "UserWorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWorkoutSession" ADD CONSTRAINT "UserWorkoutSession_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "UserPathEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWorkoutSession" ADD CONSTRAINT "UserWorkoutSession_trainingPlanId_fkey" FOREIGN KEY ("trainingPlanId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
