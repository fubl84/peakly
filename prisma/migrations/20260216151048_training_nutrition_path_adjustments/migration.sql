/*
  Warnings:

  - Changed the type of `mealType` on the `NutritionPlanMealEntry` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `unit` on the `NutritionPlanMealEntry` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "MealSlot" AS ENUM ('MORNING', 'SNACK_1', 'LUNCH', 'SNACK_2', 'DINNER', 'NIGHT');

-- CreateEnum
CREATE TYPE "AmountUnit" AS ENUM ('G', 'ML', 'EL', 'TL', 'HAND', 'STK');

-- AlterTable
ALTER TABLE "NutritionPlanMealEntry" DROP COLUMN "mealType",
ADD COLUMN     "mealType" "MealSlot" NOT NULL,
DROP COLUMN "unit",
ADD COLUMN     "unit" "AmountUnit" NOT NULL;

-- CreateIndex
CREATE INDEX "NutritionPlanMealEntry_nutritionPlanId_mealType_idx" ON "NutritionPlanMealEntry"("nutritionPlanId", "mealType");
