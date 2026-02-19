/*
  Warnings:

  - You are about to drop the column `variantOptionId` on the `Exercise` table. All the data in the column will be lost.
  - You are about to drop the column `variantOptionId` on the `NutritionPlan` table. All the data in the column will be lost.
  - You are about to drop the column `variantOptionId` on the `PathAssignment` table. All the data in the column will be lost.
  - You are about to drop the column `variantOptionId` on the `Recipe` table. All the data in the column will be lost.
  - You are about to drop the column `variantOptionId` on the `TrainingPlan` table. All the data in the column will be lost.
  - You are about to drop the column `variantOptionId` on the `UserEnrollmentVariant` table. All the data in the column will be lost.
  - You are about to drop the column `variantTypeId` on the `UserEnrollmentVariant` table. All the data in the column will be lost.
  - You are about to drop the `VariantOption` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VariantType` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[enrollmentId,variantId]` on the table `UserEnrollmentVariant` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `variantId` to the `UserEnrollmentVariant` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OptionKind" AS ENUM ('TRAINING', 'NUTRITION', 'INFO');

-- DropForeignKey
ALTER TABLE "Exercise" DROP CONSTRAINT "Exercise_variantOptionId_fkey";

-- DropForeignKey
ALTER TABLE "NutritionPlan" DROP CONSTRAINT "NutritionPlan_variantOptionId_fkey";

-- DropForeignKey
ALTER TABLE "PathAssignment" DROP CONSTRAINT "PathAssignment_variantOptionId_fkey";

-- DropForeignKey
ALTER TABLE "Recipe" DROP CONSTRAINT "Recipe_variantOptionId_fkey";

-- DropForeignKey
ALTER TABLE "TrainingPlan" DROP CONSTRAINT "TrainingPlan_variantOptionId_fkey";

-- DropForeignKey
ALTER TABLE "UserEnrollmentVariant" DROP CONSTRAINT "UserEnrollmentVariant_variantOptionId_fkey";

-- DropForeignKey
ALTER TABLE "UserEnrollmentVariant" DROP CONSTRAINT "UserEnrollmentVariant_variantTypeId_fkey";

-- DropForeignKey
ALTER TABLE "VariantOption" DROP CONSTRAINT "VariantOption_variantTypeId_fkey";

-- DropIndex
DROP INDEX "UserEnrollmentVariant_enrollmentId_variantTypeId_key";

-- AlterTable
ALTER TABLE "Exercise" DROP COLUMN "variantOptionId",
ADD COLUMN     "optionId" TEXT;

-- AlterTable
ALTER TABLE "NutritionPlan" DROP COLUMN "variantOptionId",
ADD COLUMN     "optionId" TEXT,
ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "PathAssignment" DROP COLUMN "variantOptionId",
ADD COLUMN     "optionId" TEXT,
ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "Recipe" DROP COLUMN "variantOptionId",
ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "TrainingPlan" DROP COLUMN "variantOptionId",
ADD COLUMN     "optionId" TEXT,
ADD COLUMN     "variantId" TEXT;

-- AlterTable
ALTER TABLE "UserEnrollmentVariant" DROP COLUMN "variantOptionId",
DROP COLUMN "variantTypeId",
ADD COLUMN     "variantId" TEXT NOT NULL;

-- DropTable
DROP TABLE "VariantOption";

-- DropTable
DROP TABLE "VariantType";

-- CreateTable
CREATE TABLE "Variant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "internalName" TEXT NOT NULL,
    "description" TEXT,
    "kind" "VariantKind" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Option" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "internalName" TEXT NOT NULL,
    "kind" "OptionKind" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Option_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Variant_internalName_key" ON "Variant"("internalName");

-- CreateIndex
CREATE UNIQUE INDEX "Variant_name_kind_key" ON "Variant"("name", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Option_kind_internalName_key" ON "Option"("kind", "internalName");

-- CreateIndex
CREATE UNIQUE INDEX "Option_kind_name_key" ON "Option"("kind", "name");

-- CreateIndex
CREATE UNIQUE INDEX "UserEnrollmentVariant_enrollmentId_variantId_key" ON "UserEnrollmentVariant"("enrollmentId", "variantId");

-- AddForeignKey
ALTER TABLE "UserEnrollmentVariant" ADD CONSTRAINT "UserEnrollmentVariant_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathAssignment" ADD CONSTRAINT "PathAssignment_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathAssignment" ADD CONSTRAINT "PathAssignment_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionPlan" ADD CONSTRAINT "NutritionPlan_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NutritionPlan" ADD CONSTRAINT "NutritionPlan_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "Option"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
