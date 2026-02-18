-- CreateEnum
CREATE TYPE "PairLinkStatus" AS ENUM ('PENDING', 'ACTIVE');

-- CreateTable
CREATE TABLE "UserPairLink" (
    "id" TEXT NOT NULL,
    "pairKey" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" "PairLinkStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPairLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPairLink_pairKey_key" ON "UserPairLink"("pairKey");

-- CreateIndex
CREATE INDEX "UserPairLink_inviteeId_status_idx" ON "UserPairLink"("inviteeId", "status");

-- CreateIndex
CREATE INDEX "UserPairLink_initiatorId_status_idx" ON "UserPairLink"("initiatorId", "status");

-- AddForeignKey
ALTER TABLE "UserPairLink" ADD CONSTRAINT "UserPairLink_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPairLink" ADD CONSTRAINT "UserPairLink_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
