-- CreateTable
CREATE TABLE "UserInfoBlockRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "infoBlockId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInfoBlockRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserInfoBlockRead_userId_infoBlockId_key" ON "UserInfoBlockRead"("userId", "infoBlockId");

-- CreateIndex
CREATE INDEX "UserInfoBlockRead_userId_readAt_idx" ON "UserInfoBlockRead"("userId", "readAt");

-- AddForeignKey
ALTER TABLE "UserInfoBlockRead" ADD CONSTRAINT "UserInfoBlockRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInfoBlockRead" ADD CONSTRAINT "UserInfoBlockRead_infoBlockId_fkey" FOREIGN KEY ("infoBlockId") REFERENCES "InfoBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
