import { prisma } from "@/lib/prisma";
import { TrainingPlansClient } from "./training-plans-client";

export default async function AdminTrainingPlansPage() {
  const [plans, variantOptions, exercises] = await Promise.all([
    prisma.trainingPlan.findMany({
      orderBy: [{ weekStart: "asc" }, { name: "asc" }],
      include: {
        variantOption: {
          select: { id: true, name: true },
        },
        trainingExercises: {
          orderBy: [{ block: "asc" }, { position: "asc" }],
          include: {
            exercise: {
              select: {
                id: true,
                name: true,
                metricType: true,
              },
            },
          },
        },
      },
    }),
    prisma.variantOption.findMany({
      where: { variantType: { kind: "TRAINING" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.exercise.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        metricType: true,
      },
    }),
  ]);

  return (
    <TrainingPlansClient
      plans={plans}
      variantOptions={variantOptions}
      exercises={exercises}
    />
  );
}
