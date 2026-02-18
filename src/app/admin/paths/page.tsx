import { prisma } from "@/lib/prisma";
import { PathsClient } from "./paths-client";

export default async function AdminPathsPage() {
  const [paths, trainingPlans, nutritionPlans, infoBlocks] = await Promise.all([
    prisma.path.findMany({
      orderBy: { name: "asc" },
      include: {
        assignments: {
          orderBy: [{ weekStart: "asc" }, { kind: "asc" }],
          select: {
            id: true,
            kind: true,
            weekStart: true,
            weekEnd: true,
            contentRefId: true,
            variantOptionId: true,
          },
        },
      },
    }),
    prisma.trainingPlan.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, internalName: true },
    }),
    prisma.nutritionPlan.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, internalName: true },
    }),
    prisma.infoBlock.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, internalName: true },
    }),
  ]);

  return (
    <PathsClient
      paths={paths}
      trainingPlans={trainingPlans}
      nutritionPlans={nutritionPlans}
      infoBlocks={infoBlocks}
    />
  );
}
