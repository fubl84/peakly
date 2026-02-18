import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export function canUpdateEnrollmentVariants(
  startDate: Date,
  referenceDate: Date = new Date(),
) {
  return referenceDate < startDate;
}

export async function createEnrollment(args: {
  userId: string;
  pathId: string;
  startDate: Date;
  selectedVariants: Array<{ variantTypeId: string; variantOptionId: string }>;
}) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.userPathEnrollment.updateMany({
      where: { userId: args.userId, isActive: true },
      data: { isActive: false },
    });

    const enrollment = await tx.userPathEnrollment.create({
      data: {
        userId: args.userId,
        pathId: args.pathId,
        startDate: args.startDate,
        isActive: true,
        selectedVariants: {
          create: args.selectedVariants,
        },
      },
      include: { selectedVariants: true },
    });

    return enrollment;
  });
}

export async function updateEnrollmentVariants(args: {
  enrollmentId: string;
  variantUpdates: Array<{ variantTypeId: string; variantOptionId: string }>;
}) {
  const enrollment = await prisma.userPathEnrollment.findUnique({
    where: { id: args.enrollmentId },
  });

  if (!enrollment) {
    throw new Error("Enrollment nicht gefunden.");
  }

  if (!canUpdateEnrollmentVariants(enrollment.startDate)) {
    throw new Error(
      "Varianten können nach dem Startdatum nicht geändert werden.",
    );
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const update of args.variantUpdates) {
      await tx.userEnrollmentVariant.upsert({
        where: {
          enrollmentId_variantTypeId: {
            enrollmentId: args.enrollmentId,
            variantTypeId: update.variantTypeId,
          },
        },
        update: { variantOptionId: update.variantOptionId },
        create: {
          enrollmentId: args.enrollmentId,
          variantTypeId: update.variantTypeId,
          variantOptionId: update.variantOptionId,
        },
      });
    }
  });
}
