-- CreateTable
CREATE TABLE "UserTrainingCalendarEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "trainingPlanId" TEXT,
    "isRestDay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTrainingCalendarEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserTrainingCalendarEntry_userId_week_idx" ON "UserTrainingCalendarEntry"("userId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "UserTrainingCalendarEntry_enrollmentId_week_dayOfWeek_key" ON "UserTrainingCalendarEntry"("enrollmentId", "week", "dayOfWeek");

-- AddForeignKey
ALTER TABLE "UserTrainingCalendarEntry" ADD CONSTRAINT "UserTrainingCalendarEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrainingCalendarEntry" ADD CONSTRAINT "UserTrainingCalendarEntry_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "UserPathEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTrainingCalendarEntry" ADD CONSTRAINT "UserTrainingCalendarEntry_trainingPlanId_fkey" FOREIGN KEY ("trainingPlanId") REFERENCES "TrainingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
