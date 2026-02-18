-- CreateTable
CREATE TABLE "UserShoppingList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserShoppingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserShoppingListItem" (
    "id" TEXT NOT NULL,
    "shoppingListId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ingredientId" TEXT,
    "sourceRecipeId" TEXT,
    "amount" DOUBLE PRECISION,
    "unit" TEXT,
    "isChecked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserShoppingListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserShoppingList_userId_week_idx" ON "UserShoppingList"("userId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "UserShoppingList_enrollmentId_week_key" ON "UserShoppingList"("enrollmentId", "week");

-- CreateIndex
CREATE INDEX "UserShoppingListItem_shoppingListId_isChecked_idx" ON "UserShoppingListItem"("shoppingListId", "isChecked");

-- CreateIndex
CREATE UNIQUE INDEX "UserShoppingListItem_shoppingListId_dedupeKey_key" ON "UserShoppingListItem"("shoppingListId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "UserShoppingList" ADD CONSTRAINT "UserShoppingList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserShoppingList" ADD CONSTRAINT "UserShoppingList_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "UserPathEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserShoppingListItem" ADD CONSTRAINT "UserShoppingListItem_shoppingListId_fkey" FOREIGN KEY ("shoppingListId") REFERENCES "UserShoppingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserShoppingListItem" ADD CONSTRAINT "UserShoppingListItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserShoppingListItem" ADD CONSTRAINT "UserShoppingListItem_sourceRecipeId_fkey" FOREIGN KEY ("sourceRecipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;
