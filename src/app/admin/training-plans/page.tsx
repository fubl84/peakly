import { prisma } from "@/lib/prisma";
import { TrainingPlansClient } from "./training-plans-client";

export default async function AdminTrainingPlansPage() {
  const [plans, variants, options, exercises] = await Promise.all([
    prisma.trainingPlan.findMany({
      orderBy: [{ weekStart: "asc" }, { name: "asc" }],
      include: {
        variant: {
          select: { id: true, name: true },
        },
        option: {
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
    prisma.variant.findMany({
      where: { kind: "TRAINING" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.option.findMany({
      where: { kind: "TRAINING" },
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
      variants={variants}
      options={options}
      exercises={exercises}
    />
  );
}
