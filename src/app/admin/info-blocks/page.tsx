import { prisma } from "@/lib/prisma";
import { InfoBlocksClient } from "./info-blocks-client";

export default async function AdminInfoBlocksPage() {
  const infoBlocks = await prisma.infoBlock.findMany({
    select: {
      id: true,
      name: true,
      internalName: true,
      contentHtml: true,
      videoUrl: true,
      isFullPath: true,
      weekStart: true,
      weekEnd: true,
      category: true,
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return <InfoBlocksClient infoBlocks={infoBlocks} />;
}
