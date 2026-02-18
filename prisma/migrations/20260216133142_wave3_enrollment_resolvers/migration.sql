-- CreateTable
CREATE TABLE "UserPathEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPathEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserEnrollmentVariant" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "variantTypeId" TEXT NOT NULL,
    "variantOptionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserEnrollmentVariant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPathEnrollment_userId_isActive_idx" ON "UserPathEnrollment"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "UserEnrollmentVariant_enrollmentId_variantTypeId_key" ON "UserEnrollmentVariant"("enrollmentId", "variantTypeId");

-- AddForeignKey
ALTER TABLE "UserPathEnrollment" ADD CONSTRAINT "UserPathEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPathEnrollment" ADD CONSTRAINT "UserPathEnrollment_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "Path"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEnrollmentVariant" ADD CONSTRAINT "UserEnrollmentVariant_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "UserPathEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEnrollmentVariant" ADD CONSTRAINT "UserEnrollmentVariant_variantTypeId_fkey" FOREIGN KEY ("variantTypeId") REFERENCES "VariantType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserEnrollmentVariant" ADD CONSTRAINT "UserEnrollmentVariant_variantOptionId_fkey" FOREIGN KEY ("variantOptionId") REFERENCES "VariantOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
