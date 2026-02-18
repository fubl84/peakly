import { PathAssignmentKind, PrismaClient } from "@prisma/client";

export async function resolveAssignmentsForEnrollmentWeek(args: {
  prismaClient: PrismaClient;
  pathId: string;
  week: number;
  selectedVariantOptionIds: string[];
  kind?: PathAssignmentKind;
}) {
  const assignments = await args.prismaClient.pathAssignment.findMany({
    where: {
      pathId: args.pathId,
      weekStart: { lte: args.week },
      weekEnd: { gte: args.week },
      ...(args.kind ? { kind: args.kind } : {}),
      OR: [{ variantOptionId: null }, { variantOptionId: { in: args.selectedVariantOptionIds } }],
    },
    orderBy: [{ kind: "asc" }, { weekStart: "asc" }],
  });

  return assignments;
}
