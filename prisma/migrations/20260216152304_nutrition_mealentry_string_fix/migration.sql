-- AlterTable
ALTER TABLE "NutritionPlanMealEntry"
ALTER COLUMN "mealType" TYPE TEXT USING "mealType"::TEXT,
ALTER COLUMN "unit" TYPE TEXT USING "unit"::TEXT;

-- DropEnum
DROP TYPE IF EXISTS "MealSlot";

-- DropEnum
DROP TYPE IF EXISTS "AmountUnit";

