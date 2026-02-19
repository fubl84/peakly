import { prisma } from "@/lib/prisma";
import { ExercisesClient } from "./exercises-client";

export default async function AdminExercisesPage() {
  const [exercises, options] = await Promise.all([
    prisma.exercise.findMany({
      orderBy: { name: "asc" },
      include: {
        option: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.option.findMany({
      where: { kind: "TRAINING" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return <ExercisesClient exercises={exercises} options={options} />;
}
