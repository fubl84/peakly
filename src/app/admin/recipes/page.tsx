import { prisma } from "@/lib/prisma";
import { RecipesClient } from "./recipes-client";

export default async function AdminRecipesPage() {
  const [recipes, variantOptions, ingredients] = await Promise.all([
    prisma.recipe.findMany({
      orderBy: { name: "asc" },
      include: {
        variantOption: {
          select: { id: true, name: true },
        },
        ingredients: {
          include: {
            ingredient: {
              select: { id: true, name: true },
            },
          },
        },
        steps: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            position: true,
            description: true,
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
    <RecipesClient
      recipes={recipes}
      variantOptions={variantOptions}
      ingredients={ingredients}
    />
  );
}
