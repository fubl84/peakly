import { auth } from "@/auth";
import { generateGeminiText } from "@/lib/ai/gemini";
import {
  beginApiRequest,
  completeApiRequest,
  withRequestIdHeader,
} from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type RecipeContextRow = {
  name: string;
  description: string | null;
  nutritionCalories: number | null;
  nutritionProtein: number | null;
  nutritionCarbs: number | null;
  nutritionFat: number | null;
  ingredients: {
    ingredient: {
      name: string;
    };
  }[];
};

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function formatOneDecimal(value: number | null) {
  if (value === null) {
    return "-";
  }

  return value.toFixed(1);
}

export async function POST(request: Request) {
  const ctx = beginApiRequest(request, "/api/ai/nutrition-recipes-assistant");
  const session = await auth();
  const userId = session?.user?.id;

  const respond = (response: NextResponse, errorMessage?: string) => {
    completeApiRequest({
      ctx,
      status: response.status,
      userId,
      errorMessage,
    });

    return withRequestIdHeader(response, ctx.requestId);
  };

  if (!userId) {
    return respond(
      NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 }),
      "Nicht angemeldet.",
    );
  }

  try {
    const body = (await request.json()) as {
      note?: unknown;
    };

    const note = normalizeText(body.note);
    if (!note) {
      return respond(
        NextResponse.json(
          { error: "Bitte gib eine Frage ein." },
          { status: 400 },
        ),
        "Leere Rezeptfrage.",
      );
    }

    const enrollment = await prisma.userPathEnrollment.findFirst({
      where: { userId, isActive: true },
      include: {
        selectedVariants: {
          select: { variantId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const selectedVariantIds =
      enrollment?.selectedVariants.map(
        (entry: { variantId: string }) => entry.variantId,
      ) ?? [];

    const recipes = (await prisma.recipe.findMany({
      where: {
        OR: [{ variantId: null }, { variantId: { in: selectedVariantIds } }],
      },
      select: {
        name: true,
        description: true,
        nutritionCalories: true,
        nutritionProtein: true,
        nutritionCarbs: true,
        nutritionFat: true,
        ingredients: {
          select: {
            ingredient: {
              select: {
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
      orderBy: { name: "asc" },
    })) as RecipeContextRow[];

    if (!recipes.length) {
      return respond(
        NextResponse.json(
          { error: "Keine Rezepte verfügbar. Bitte später erneut versuchen." },
          { status: 400 },
        ),
        "Keine Rezepte für AI vorhanden.",
      );
    }

    const recipesContext = recipes
      .map((recipe) => {
        const ingredients = recipe.ingredients
          .map((entry) => entry.ingredient.name)
          .slice(0, 12)
          .join(", ");

        return [
          `- ${recipe.name}`,
          `  Nährwerte: kcal ${formatOneDecimal(recipe.nutritionCalories)}, Protein ${formatOneDecimal(recipe.nutritionProtein)}g, Kohlenhydrate ${formatOneDecimal(recipe.nutritionCarbs)}g, Fett ${formatOneDecimal(recipe.nutritionFat)}g`,
          `  Zutaten: ${ingredients || "-"}`,
          recipe.description ? `  Beschreibung: ${recipe.description}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");

    const prompt = [
      "Du bist ein deutschsprachiger Ernährungs-Assistent für eine Rezeptdatenbank.",
      "Antworte nur auf Basis der bereitgestellten Rezepte und Nährwerte.",
      "Antwortregeln:",
      "- Nur Deutsch",
      "- 4 bis 8 Sätze",
      "- Gib 2-5 konkrete Rezeptvorschläge, wenn möglich",
      "- Berücksichtige Zutat- und Makrogrenzen explizit",
      "- Wenn keine exakte Übereinstimmung existiert, nenne die nächsten Treffer mit kurzer Begründung",
      `Nutzerfrage: ${note}`,
      `Verfügbare Rezepte:\n${recipesContext}`,
    ].join("\n\n");

    const message = (await generateGeminiText({ prompt, userId }))
      .trim()
      .slice(0, 2500);

    await prisma.aIInteraction.create({
      data: {
        userId,
        type: "NUTRITION_RECIPES_ASSISTANT",
        request: JSON.stringify({ note }).slice(0, 4000),
        response: message,
      },
    });

    return respond(
      NextResponse.json({
        data: {
          message,
        },
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unbekannter AI-Fehler für Rezeptsuche";

    await prisma.aIInteraction.create({
      data: {
        userId,
        type: "NUTRITION_RECIPES_ASSISTANT_ERROR",
        request: "POST /api/ai/nutrition-recipes-assistant",
        error: message,
      },
    });

    return respond(
      NextResponse.json({ error: message }, { status: 500 }),
      message,
    );
  }
}
