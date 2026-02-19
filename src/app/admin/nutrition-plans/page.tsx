import { prisma } from "@/lib/prisma";
import { NutritionPlansClient } from "./nutrition-plans-client";

export default async function AdminNutritionPlansPage() {
  const [plans, variants, options, ingredients] = await Promise.all([
    prisma.nutritionPlan.findMany({
      orderBy: [{ weekStart: "asc" }, { name: "asc" }],
      include: {
        variant: {
          select: { id: true, name: true },
        },
        option: {
          select: { id: true, name: true },
        },
        mealEntries: {
          orderBy: [{ mealType: "asc" }, { createdAt: "asc" }],
          include: {
            ingredient: {
              select: { id: true, name: true },
            },
            alternatives: {
              include: {
                ingredient: {
                  select: { id: true, name: true },
                },
              },
              orderBy: { ingredient: { name: "asc" } },
            },
          },
        },
      },
    }),
    prisma.variant.findMany({
      where: { kind: "NUTRITION" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.option.findMany({
      where: { kind: "NUTRITION" },
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
      variants={variants}
      options={options}
      ingredients={ingredients}
    />
  );
}
