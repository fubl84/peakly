-- CreateTable
CREATE TABLE "VideoAsset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoAsset_url_key" ON "VideoAsset"("url");

-- CreateIndex
CREATE INDEX "VideoAsset_name_idx" ON "VideoAsset"("name");

-- CreateIndex
CREATE INDEX "VideoAsset_createdAt_idx" ON "VideoAsset"("createdAt");
