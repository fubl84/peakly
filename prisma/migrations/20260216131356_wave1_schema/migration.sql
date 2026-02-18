-- CreateEnum
CREATE TYPE "VariantKind" AS ENUM ('TRAINING', 'NUTRITION');

-- CreateEnum
CREATE TYPE "ExerciseMetricType" AS ENUM ('REPETITIONS', 'DURATION');

-- CreateEnum
CREATE TYPE "ExerciseSideMode" AS ENUM ('NONE', 'ONE_SIDE', 'BOTH_SIDES');

-- CreateEnum
CREATE TYPE "InfoCategory" AS ENUM ('FOOD', 'WORKOUT', 'MOTIVATION', 'GENERAL');

-- CreateEnum
CREATE TYPE "PathAssignmentKind" AS ENUM ('TRAINING', 'NUTRITION', 'INFO');

-- CreateTable
CREATE TABLE "Path" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Path_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathAssignment" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "kind" "PathAssignmentKind" NOT NULL,
    "weekStart" INTEGER NOT NULL,
    "weekEnd" INTEGER NOT NULL,
    "contentRefId" TEXT NOT NULL,
    "variantOptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PathAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "internalName" TEXT NOT NULL,
    "description" TEXT,
    "kind" "VariantKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariantType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantOption" (
    "id" TEXT NOT NULL,
    "variantTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "internalName" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariantOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "internalName" TEXT NOT NULL,
    "description" TEXT,
    "metricType" "ExerciseMetricType" NOT NULL,
    "sideMode" "ExerciseSideMode" NOT NULL DEFAULT 'NONE',
    "mediaUrl" TEXT,
    "variantOptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "internalName" TEXT NOT NULL,
    "description" TEXT,
    "weekStart" INTEGER NOT NULL,
    "weekEnd" INTEGER NOT NULL,
    "variantOptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingPlanExercise" (
    "id" TEXT NOT NULL,
    "trainingPlanId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "block" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "reps" INTEGER,
    "durationSec" INTEGER,
    "restSec" INTEGER,
    "info" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingPlanExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "fat" DOUBLE PRECISION,
    "carbs" DOUBLE PRECISION,
    "protein" DOUBLE PRECISION,
    "calories" DOUBLE PRECISION,
    "fiber" DOUBLE PRECISION,
    "sugar" DOUBLE PRECISION,
    "salt" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutritionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "internalName" TEXT NOT NULL,
    "description" TEXT,
    "weekStart" INTEGER NOT NULL,
    "weekEnd" INTEGER NOT NULL,
    "variantOptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NutritionPlanMealEntry" (
    "id" TEXT NOT NULL,
    "nutritionPlanId" TEXT NOT NULL,
    "mealType" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NutritionPlanMealEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "internalName" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "tips" TEXT,
    "variantOptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeStep" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecipeStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InfoBlock" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "internalName" TEXT NOT NULL,
    "contentHtml" TEXT NOT NULL,
    "isFullPath" BOOLEAN NOT NULL DEFAULT false,
    "weekStart" INTEGER,
    "weekEnd" INTEGER,
    "category" "InfoCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InfoBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Path_name_key" ON "Path"("name");

-- CreateIndex
CREATE INDEX "PathAssignment_pathId_kind_weekStart_weekEnd_idx" ON "PathAssignment"("pathId", "kind", "weekStart", "weekEnd");

-- CreateIndex
CREATE UNIQUE INDEX "VariantType_internalName_key" ON "VariantType"("internalName");

-- CreateIndex
CREATE UNIQUE INDEX "VariantType_name_kind_key" ON "VariantType"("name", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "VariantOption_variantTypeId_internalName_key" ON "VariantOption"("variantTypeId", "internalName");

-- CreateIndex
CREATE UNIQUE INDEX "VariantOption_variantTypeId_name_key" ON "VariantOption"("variantTypeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_internalName_key" ON "Exercise"("internalName");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_name_key" ON "Exercise"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingPlan_internalName_key" ON "TrainingPlan"("internalName");

-- CreateIndex
CREATE INDEX "TrainingPlanExercise_trainingPlanId_block_position_idx" ON "TrainingPlanExercise"("trainingPlanId", "block", "position");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_name_key" ON "Ingredient"("name");

-- CreateIndex
CREATE UNIQUE INDEX "NutritionPlan_internalName_key" ON "NutritionPlan"("internalName");

-- CreateIndex
CREATE INDEX "NutritionPlanMealEntry_nutritionPlanId_mealType_idx" ON "NutritionPlanMealEntry"("nutritionPlanId", "mealType");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_internalName_key" ON "Recipe"("internalName");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeStep_recipeId_position_key" ON "RecipeStep"("recipeId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "InfoBlock_internalName_key" ON "InfoBlock"("internalName");

-- AddForeignKey
ALTER TABLE "PathAssignment" ADD CONSTRAINT "PathAssignment_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "Path"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathAssignment" ADD CONSTRAINT "PathAssignment_variantOptionId_fkey" FOREIGN KEY ("variantOptionId") REFERENCES "VariantOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantOption" ADD CONSTRAINT "VariantOption_variantTypeId_fkey" FOREIGN KEY ("variantTypeId") REFERENCES "VariantType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_variantOptionId_fkey" FOREIGN KEY ("variantOptionId") REFERENCES "VariantOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_variantOptionId_fkey" FOREIGN KEY ("variantOptionId") REFERENCES "VariantOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPlanExercise" ADD CONSTRAINT "TrainingPlanExercise_trainingPlanId_fkey" FOREIGN KEY ("trainingPlanId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPlanExercise" ADD CONSTRAINT "TrainingPlanExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionPlan" ADD CONSTRAINT "NutritionPlan_variantOptionId_fkey" FOREIGN KEY ("variantOptionId") REFERENCES "VariantOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionPlanMealEntry" ADD CONSTRAINT "NutritionPlanMealEntry_nutritionPlanId_fkey" FOREIGN KEY ("nutritionPlanId") REFERENCES "NutritionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionPlanMealEntry" ADD CONSTRAINT "NutritionPlanMealEntry_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_variantOptionId_fkey" FOREIGN KEY ("variantOptionId") REFERENCES "VariantOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeStep" ADD CONSTRAINT "RecipeStep_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
