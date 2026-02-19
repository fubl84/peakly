import { prisma } from "@/lib/prisma";
import { RecipesClient } from "./recipes-client";

export default async function AdminRecipesPage() {
  const [recipes, variants, ingredients] = await Promise.all([
    prisma.recipe.findMany({
      orderBy: { name: "asc" },
      include: {
        variant: {
          select: { id: true, name: true },
        },
        ingredients: {
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
    prisma.variant.findMany({
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
    <RecipesClient
      recipes={recipes}
      variants={variants}
      ingredients={ingredients}
    />
  );
}
