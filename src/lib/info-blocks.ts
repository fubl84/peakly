import { InfoCategory, PrismaClient } from "@prisma/client";
import { resolveAssignmentsForEnrollmentWeek } from "@/lib/variant-resolver";

type ResolveUserInfoBlocksArgs = {
  prismaClient: PrismaClient;
  userId: string;
  pathId: string;
  week: number;
  selectedVariantIds: string[];
  categories: InfoCategory[];
};

export type UserInfoBlockFeedItem = {
  id: string;
  name: string;
  contentHtml: string;
  videoUrl: string | null;
  category: InfoCategory;
  isUnread: boolean;
};

export async function resolveUserInfoBlocksForWeek(
  args: ResolveUserInfoBlocksArgs,
): Promise<UserInfoBlockFeedItem[]> {
  const infoAssignments = await resolveAssignmentsForEnrollmentWeek({
    prismaClient: args.prismaClient,
    pathId: args.pathId,
    week: args.week,
    selectedVariantIds: args.selectedVariantIds,
    kind: "INFO",
  });

  const assignedInfoBlockIds = Array.from(
    new Set(
      infoAssignments
        .map((assignment: { contentRefId: string }) => assignment.contentRefId)
        .filter((id) => Boolean(id)),
    ),
  );

  if (!assignedInfoBlockIds.length || !args.categories.length) {
    return [];
  }

  const infoBlocks = await args.prismaClient.infoBlock.findMany({
    where: {
      id: { in: assignedInfoBlockIds },
      category: { in: args.categories },
      OR: [
        { isFullPath: true },
        {
          isFullPath: false,
          weekStart: { lte: args.week },
          weekEnd: { gte: args.week },
        },
      ],
    },
    orderBy: [{ category: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      contentHtml: true,
      videoUrl: true,
      category: true,
      isFullPath: true,
      weekStart: true,
      weekEnd: true,
    },
  });

  if (!infoBlocks.length) {
    return [];
  }

  const reads = await args.prismaClient.userInfoBlockRead.findMany({
    where: {
      userId: args.userId,
      infoBlockId: { in: infoBlocks.map((block) => block.id) },
    },
    select: { infoBlockId: true },
  });

  const readSet = new Set(
    reads.map((entry: { infoBlockId: string }) => entry.infoBlockId),
  );

  return infoBlocks.map((block) => ({
    id: block.id,
    name: block.name,
    contentHtml: block.contentHtml,
    videoUrl: block.videoUrl,
    category: block.category,
    isUnread: !readSet.has(block.id),
  }));
}
