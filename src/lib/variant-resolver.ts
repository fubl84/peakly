import { PathAssignmentKind, PrismaClient } from "@prisma/client";

export async function resolveAssignmentsForEnrollmentWeek(args: {
  prismaClient: PrismaClient;
  pathId: string;
  week: number;
  selectedVariantIds: string[];
  kind?: PathAssignmentKind;
}) {
  const assignments = await args.prismaClient.pathAssignment.findMany({
    where: {
      pathId: args.pathId,
      weekStart: { lte: args.week },
      weekEnd: { gte: args.week },
      ...(args.kind ? { kind: args.kind } : {}),
      OR: [{ variantId: null }, { variantId: { in: args.selectedVariantIds } }],
    },
    orderBy: [{ kind: "asc" }, { weekStart: "asc" }],
  });

  return assignments;
}
