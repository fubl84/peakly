import { prisma } from "@/lib/prisma";
import { ExercisesClient } from "./exercises-client";

export default async function AdminExercisesPage() {
  const [exercises, variantOptions] = await Promise.all([
    prisma.exercise.findMany({
      orderBy: { name: "asc" },
      include: {
        variantOption: {
          include: {
            variantType: true,
          },
        },
      },
    }),
    prisma.variantOption.findMany({
      orderBy: { name: "asc" },
      include: {
        variantType: true,
      },
    }),
  ]);

  return (
    <ExercisesClient exercises={exercises} variantOptions={variantOptions} />
  );
}
