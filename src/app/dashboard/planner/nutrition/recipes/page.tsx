import { requireAuth } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { NutritionRecipesClient } from "./recipes-client";

type RecipeRow = {
  id: string;
  name: string;
  description: string | null;
  tips: string | null;
  imageUrl: string | null;
  nutritionCalories: number | null;
  nutritionProtein: number | null;
  nutritionCarbs: number | null;
  nutritionFat: number | null;
  variantOption: {
    name: string;
  } | null;
  ingredients: {
    amount: number;
    unit: string;
    ingredient: {
      name: string;
    };
    alternatives: {
      ingredient: {
        id: string;
        name: string;
      };
    }[];
  }[];
  steps: {
    position: number;
    description: string;
  }[];
};

function formatAmount(amount: number, unit: string) {
  return `${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(1)} ${unit}`;
}

export default async function NutritionRecipesPage() {
  const session = await requireAuth();

  const enrollment = await prisma.userPathEnrollment.findFirst({
    where: { userId: session.user.id, isActive: true },
    include: {
      selectedVariants: {
        select: { variantOptionId: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const selectedVariantOptionIds =
    enrollment?.selectedVariants.map(
      (entry: { variantOptionId: string }) => entry.variantOptionId,
    ) ?? [];

  const recipes = (await prisma.recipe.findMany({
    where: {
      OR: [
        { variantOptionId: null },
        { variantOptionId: { in: selectedVariantOptionIds } },
      ],
    },
    orderBy: { name: "asc" },
    include: {
      variantOption: {
        select: {
          name: true,
        },
      },
      ingredients: {
        include: {
          ingredient: {
            select: {
              name: true,
            },
          },
          alternatives: {
            include: {
              ingredient: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: {
              ingredient: {
                name: "asc",
              },
            },
          },
        },
        orderBy: {
          ingredient: {
            name: "asc",
          },
        },
      },
      steps: {
        select: {
          position: true,
          description: true,
        },
        orderBy: {
          position: "asc",
        },
      },
    },
  })) as RecipeRow[];

  const normalizedRecipes = recipes.map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    tips: recipe.tips,
    imageUrl: recipe.imageUrl,
    variantName: recipe.variantOption?.name ?? null,
    nutrition: {
      calories: recipe.nutritionCalories,
      protein: recipe.nutritionProtein,
      carbs: recipe.nutritionCarbs,
      fat: recipe.nutritionFat,
    },
    ingredients: recipe.ingredients.map((entry) => ({
      name: entry.ingredient.name,
      amountLabel: formatAmount(entry.amount, entry.unit),
      alternatives: entry.alternatives.map((alternative) => ({
        id: alternative.ingredient.id,
        name: alternative.ingredient.name,
      })),
    })),
    steps: recipe.steps.map((step) => step.description),
  }));

  return (
    <main className="dashboard-page">
      <h1 className="page-title">Ernährung · Rezepte</h1>
      <Link className="back-link" href="/dashboard/planner/nutrition">
        Zum Ernährungsplan
      </Link>

      <NutritionRecipesClient recipes={normalizedRecipes} />
    </main>
  );
}
