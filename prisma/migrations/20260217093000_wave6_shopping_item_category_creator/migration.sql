-- AlterTable
ALTER TABLE "UserShoppingListItem"
ADD COLUMN "category" TEXT NOT NULL DEFAULT 'other',
ADD COLUMN "createdByUserId" TEXT;

-- CreateIndex
CREATE INDEX "UserShoppingListItem_shoppingListId_category_idx"
ON "UserShoppingListItem"("shoppingListId", "category");

-- AddForeignKey
ALTER TABLE "UserShoppingListItem"
ADD CONSTRAINT "UserShoppingListItem_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
