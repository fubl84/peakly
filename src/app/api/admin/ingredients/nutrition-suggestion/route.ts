import { auth } from "@/auth";
import { generateGeminiText } from "@/lib/ai/gemini";
import { parseIngredientNutritionSuggestionResponse } from "@/lib/ai/ingredient-nutrition-suggestion";
import { evaluateAdminApiAccess } from "@/lib/api-access";
import {
  beginApiRequest,
  completeApiRequest,
  withRequestIdHeader,
} from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type SuggestionLanguage = "de" | "en";

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeLanguage(value: unknown): SuggestionLanguage {
  if (value === "en") {
    return "en";
  }

  return "de";
}

function buildPrompt(args: {
  ingredientName: string;
  description: string;
  alternativeDescription: string;
  language: SuggestionLanguage;
}) {
  const responseLanguage = args.language === "en" ? "English" : "Deutsch";

  return [
    "You are a nutrition data assistant for an admin system.",
    `Respond in ${responseLanguage}.`,
    "Search strategy: First look for nutrition values in FDDB (fddb.info) using German search terms for the ingredient.",
    "If FDDB data is found and sufficient, use FDDB as primary source for nutritionPer100g.",
    "If FDDB data is missing, incomplete, or inconsistent, then broaden search to other reliable nutrition sources and fill remaining gaps.",
    "You must estimate nutrition values per 100g for a single ingredient.",
    "Also estimate practical conversion factors for household units in grams for this specific ingredient.",
    "In 'reason', briefly mention whether values came from FDDB only or FDDB plus broader sources.",
    "If data is uncertain, lower confidence and mark needsAlternativeDescription=true.",
    "If ingredient cannot be identified reliably, set found=false and needsAlternativeDescription=true.",
    "Output strictly valid JSON without markdown fences.",
    "Schema:",
    '{"found":true|false,"confidence":"HIGH"|"MEDIUM"|"LOW","reason":"...","nutritionPer100g":{"calories":number|null,"protein":number|null,"carbs":number|null,"fat":number|null,"fiber":number|null,"sugar":number|null,"salt":number|null},"conversionEstimates":{"mlDensityGPerMl":number|null,"gramsPerPiece":number|null,"gramsPerHand":number|null,"gramsPerTeaspoon":number|null,"gramsPerTablespoon":number|null,"gramsPerPinch":number|null,"gramsPerCup":number|null,"gramsPerSlice":number|null,"gramsPerBunch":number|null,"gramsPerCan":number|null},"needsAlternativeDescription":true|false,"suggestedAlternativeDescription":"string|null"}',
    `Ingredient name: ${args.ingredientName}`,
    args.description ? `Ingredient description: ${args.description}` : null,
    args.alternativeDescription
      ? `Alternative description from admin: ${args.alternativeDescription}`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function POST(request: Request) {
  const ctx = beginApiRequest(
    request,
    "/api/admin/ingredients/nutrition-suggestion",
  );
  const session = await auth();
  const userId = session?.user?.id;
  const accessError = evaluateAdminApiAccess(session ?? null);

  const respond = (response: NextResponse, errorMessage?: string) => {
    completeApiRequest({
      ctx,
      status: response.status,
      userId,
      errorMessage,
    });
    return withRequestIdHeader(response, ctx.requestId);
  };

  if (accessError) {
    return respond(accessError, "Keine Berechtigung für Admin-API.");
  }

  if (!userId) {
    return respond(
      NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 }),
      "Nicht angemeldet.",
    );
  }

  try {
    const body = (await request.json()) as {
      ingredientName?: unknown;
      description?: unknown;
      alternativeDescription?: unknown;
      language?: unknown;
    };

    const ingredientName = normalizeText(body.ingredientName);
    const description = normalizeText(body.description);
    const alternativeDescription = normalizeText(body.alternativeDescription);
    const language = normalizeLanguage(body.language);

    if (!ingredientName) {
      return respond(
        NextResponse.json(
          { error: "Zutatname ist erforderlich." },
          { status: 400 },
        ),
        "Zutatname fehlt.",
      );
    }

    const prompt = buildPrompt({
      ingredientName,
      description,
      alternativeDescription,
      language,
    });

    const raw = await generateGeminiText({
      prompt,
      useWebSearch: true,
      userId,
    });

    const suggestion = parseIngredientNutritionSuggestionResponse(raw);

    await prisma.aIInteraction.create({
      data: {
        userId,
        type: "ADMIN_INGREDIENT_NUTRITION_SUGGESTION",
        request: JSON.stringify({
          ingredientName,
          description,
          alternativeDescription,
          language,
        }).slice(0, 4000),
        response: JSON.stringify(suggestion).slice(0, 4000),
      },
    });

    return respond(
      NextResponse.json({
        data: suggestion,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unbekannter Fehler bei KI-Vorschlag.";

    if (userId) {
      await prisma.aIInteraction.create({
        data: {
          userId,
          type: "ADMIN_INGREDIENT_NUTRITION_SUGGESTION_ERROR",
          request: "POST /api/admin/ingredients/nutrition-suggestion",
          error: message,
        },
      });
    }

    return respond(
      NextResponse.json({ error: message }, { status: 500 }),
      message,
    );
  }
}
