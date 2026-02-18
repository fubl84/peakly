import { prisma } from "@/lib/prisma";
import { resolveAssignmentsForEnrollmentWeek } from "@/lib/variant-resolver";
import { resolveEnrollmentWeek } from "@/lib/week-resolver";

export async function getActiveEnrollment(userId: string) {
  return prisma.userPathEnrollment.findFirst({
    where: { userId, isActive: true },
    include: {
      path: true,
      selectedVariants: {
        include: {
          variantType: true,
          variantOption: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function resolveUserWeekBundle(userId: string) {
  const enrollment = await getActiveEnrollment(userId);

  if (!enrollment) {
    return null;
  }

  const pathMaxWeek = await prisma.pathAssignment.aggregate({
    where: { pathId: enrollment.pathId },
    _max: { weekEnd: true },
  });

  const week = resolveEnrollmentWeek({
    startDate: enrollment.startDate,
    maxWeeks: pathMaxWeek._max.weekEnd ?? undefined,
  });

  const selectedVariantOptionIds = enrollment.selectedVariants.map((entry) => entry.variantOptionId);

  const assignments = await resolveAssignmentsForEnrollmentWeek({
    prismaClient: prisma,
    pathId: enrollment.pathId,
    week,
    selectedVariantOptionIds,
  });

  return {
    enrollment,
    week,
    assignments,
    maxWeek: pathMaxWeek._max.weekEnd ?? 0,
  };
}
