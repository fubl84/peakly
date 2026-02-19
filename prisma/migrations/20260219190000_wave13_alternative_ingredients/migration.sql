-- CreateTable
CREATE TABLE "NutritionPlanMealEntryAlternative" (
    "id" TEXT NOT NULL,
    "mealEntryId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NutritionPlanMealEntryAlternative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredientAlternative" (
    "id" TEXT NOT NULL,
    "recipeIngredientId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeIngredientAlternative_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NutritionPlanMealEntryAlternative_mealEntryId_ingredientId_key" ON "NutritionPlanMealEntryAlternative"("mealEntryId", "ingredientId");

-- CreateIndex
CREATE INDEX "NutritionPlanMealEntryAlternative_mealEntryId_idx" ON "NutritionPlanMealEntryAlternative"("mealEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeIngredientAlternative_recipeIngredientId_ingredientId_key" ON "RecipeIngredientAlternative"("recipeIngredientId", "ingredientId");

-- CreateIndex
CREATE INDEX "RecipeIngredientAlternative_recipeIngredientId_idx" ON "RecipeIngredientAlternative"("recipeIngredientId");

-- AddForeignKey
ALTER TABLE "NutritionPlanMealEntryAlternative" ADD CONSTRAINT "NutritionPlanMealEntryAlternative_mealEntryId_fkey" FOREIGN KEY ("mealEntryId") REFERENCES "NutritionPlanMealEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionPlanMealEntryAlternative" ADD CONSTRAINT "NutritionPlanMealEntryAlternative_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredientAlternative" ADD CONSTRAINT "RecipeIngredientAlternative_recipeIngredientId_fkey" FOREIGN KEY ("recipeIngredientId") REFERENCES "RecipeIngredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredientAlternative" ADD CONSTRAINT "RecipeIngredientAlternative_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
