import { prisma } from "@/lib/prisma";
import { NutritionPlansClient } from "./nutrition-plans-client";

export default async function AdminNutritionPlansPage() {
  const [plans, variantOptions, ingredients] = await Promise.all([
    prisma.nutritionPlan.findMany({
      orderBy: [{ weekStart: "asc" }, { name: "asc" }],
      include: {
        variantOption: {
          select: { id: true, name: true },
        },
        mealEntries: {
          orderBy: [{ mealType: "asc" }, { createdAt: "asc" }],
          include: {
            ingredient: {
              select: { id: true, name: true },
            },
          },
        },
      },
    }),
    prisma.variantOption.findMany({
      where: { variantType: { kind: "NUTRITION" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.ingredient.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <NutritionPlansClient
      plans={plans}
      variantOptions={variantOptions}
      ingredients={ingredients}
    />
  );
}
