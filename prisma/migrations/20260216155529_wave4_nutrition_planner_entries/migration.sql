-- CreateTable
CREATE TABLE "UserNutritionCalendarEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "mealType" TEXT NOT NULL,
    "recipeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNutritionCalendarEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserNutritionCalendarEntry_userId_week_idx" ON "UserNutritionCalendarEntry"("userId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "UserNutritionCalendarEntry_enrollmentId_week_dayOfWeek_meal_key" ON "UserNutritionCalendarEntry"("enrollmentId", "week", "dayOfWeek", "mealType");

-- AddForeignKey
ALTER TABLE "UserNutritionCalendarEntry" ADD CONSTRAINT "UserNutritionCalendarEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNutritionCalendarEntry" ADD CONSTRAINT "UserNutritionCalendarEntry_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "UserPathEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserNutritionCalendarEntry" ADD CONSTRAINT "UserNutritionCalendarEntry_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
