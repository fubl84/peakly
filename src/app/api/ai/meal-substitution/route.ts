import { auth } from "@/auth";
import { generateGeminiText } from "@/lib/ai/gemini";
import {
  beginApiRequest,
  completeApiRequest,
  withRequestIdHeader,
} from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type SuggestionMode = "MEAL_SUBSTITUTION" | "RECIPE_ADAPTATION";

type SuggestionItem = {
  title: string;
  recipeId: string | null;
  rationale: string;
};

type SuggestionPayload = {
  kind: SuggestionMode;
  summary: string;
  suggestions: SuggestionItem[];
};

type AllowedRecipe = {
  id: string;
  name: string;
  description: string | null;
  variantOptionId: string | null;
};

function normalizeMode(value: unknown): SuggestionMode {
  if (value === "MEAL_SUBSTITUTION" || value === "RECIPE_ADAPTATION") {
    return value;
  }

  throw new Error(
    "Ungültiger Modus. Erlaubt: MEAL_SUBSTITUTION oder RECIPE_ADAPTATION.",
  );
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function extractJson(raw: string) {
  const fenced = /```json\s*([\s\S]*?)```/i.exec(raw);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return raw.slice(firstBrace, lastBrace + 1).trim();
  }

  return raw.trim();
}

function validateSuggestionPayload(args: {
  payload: unknown;
  expectedMode: SuggestionMode;
  allowedRecipeIds: Set<string>;
}) {
  const { payload, expectedMode, allowedRecipeIds } = args;

  if (!payload || typeof payload !== "object") {
    throw new Error("AI-Antwort ist kein JSON-Objekt.");
  }

  const candidate = payload as {
    kind?: unknown;
    summary?: unknown;
    suggestions?: unknown;
  };

  if (candidate.kind !== expectedMode) {
    throw new Error("AI-Antwort enthält einen ungültigen Modus.");
  }

  if (
    typeof candidate.summary !== "string" ||
    candidate.summary.trim().length < 3
  ) {
    throw new Error("AI-Antwort enthält keine gültige Zusammenfassung.");
  }

  if (
    !Array.isArray(candidate.suggestions) ||
    candidate.suggestions.length === 0
  ) {
    throw new Error("AI-Antwort enthält keine Vorschläge.");
  }

  const suggestions = candidate.suggestions.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new Error("Vorschlag hat ungültiges Format.");
    }

    const item = entry as {
      title?: unknown;
      recipeId?: unknown;
      rationale?: unknown;
    };

    const title = typeof item.title === "string" ? item.title.trim() : "";
    const rationale =
      typeof item.rationale === "string" ? item.rationale.trim() : "";
    const recipeId =
      item.recipeId === null
        ? null
        : typeof item.recipeId === "string"
          ? item.recipeId.trim()
          : "";

    if (!title) {
      throw new Error("Ein Vorschlag enthält keinen Titel.");
    }

    if (!rationale) {
      throw new Error("Ein Vorschlag enthält keine Begründung.");
    }

    if (recipeId && !allowedRecipeIds.has(recipeId)) {
      throw new Error(
        "AI-Antwort enthält ein Rezept außerhalb der erlaubten Varianten.",
      );
    }

    return {
      title,
      recipeId: recipeId || null,
      rationale,
    };
  });

  return {
    kind: expectedMode,
    summary: candidate.summary.trim(),
    suggestions,
  } satisfies SuggestionPayload;
}

export async function POST(request: Request) {
  const ctx = beginApiRequest(request, "/api/ai/meal-substitution");
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
      mode?: unknown;
      mealType?: unknown;
      currentRecipeId?: unknown;
      userGoal?: unknown;
    };

    const mode = normalizeMode(body.mode);
    const mealType = normalizeText(body.mealType);
    const currentRecipeId = normalizeText(body.currentRecipeId);
    const userGoal = normalizeText(body.userGoal);
    const requestSummary = JSON.stringify({
      mode,
      mealType,
      currentRecipeId,
      userGoal,
    }).slice(0, 4000);

    const enrollment = await prisma.userPathEnrollment.findFirst({
      where: { userId: session.user.id, isActive: true },
      include: {
        selectedVariants: {
          include: {
            variantOption: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!enrollment) {
      return respond(
        NextResponse.json(
          { error: "Keine aktive Teilnahme gefunden." },
          { status: 400 },
        ),
        "Keine aktive Teilnahme gefunden.",
      );
    }

    const selectedVariantOptionIds = enrollment.selectedVariants.map(
      (entry: { variantOptionId: string }) => entry.variantOptionId,
    );

    const allowedRecipes = await prisma.recipe.findMany({
      where: {
        OR: [
          { variantOptionId: null },
          { variantOptionId: { in: selectedVariantOptionIds } },
        ],
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        variantOptionId: true,
      },
      take: 80,
    });

    if (allowedRecipes.length === 0) {
      return respond(
        NextResponse.json(
          { error: "Für deine Varianten sind keine Rezepte verfügbar." },
          { status: 400 },
        ),
        "Keine Rezepte für Varianten verfügbar.",
      );
    }

    const allowedRecipeIds = new Set<string>(
      allowedRecipes.map((recipe: AllowedRecipe) => recipe.id),
    );

    if (currentRecipeId && !allowedRecipeIds.has(currentRecipeId)) {
      return respond(
        NextResponse.json(
          {
            error:
              "Das angegebene Rezept ist für deine Variante nicht erlaubt.",
          },
          { status: 400 },
        ),
        "Ungültiges Rezept für Variante.",
      );
    }

    const variantContext = enrollment.selectedVariants
      .map(
        (entry: { variantOption: { name: string } }) =>
          `- ${entry.variantOption.name}`,
      )
      .join("\n");

    const recipeContext = allowedRecipes
      .map((recipe: AllowedRecipe) => {
        const description = recipe.description?.trim() || "ohne Beschreibung";
        return `${recipe.id} | ${recipe.name} | ${description}`;
      })
      .join("\n");

    const aiPrompt = [
      "Du bist ein deutschsprachiger Ernährungsassistent.",
      `Modus: ${mode}`,
      mealType ? `Meal Slot: ${mealType}` : null,
      currentRecipeId ? `Aktuelles Rezept: ${currentRecipeId}` : null,
      userGoal ? `Ziel des Nutzers: ${userGoal}` : null,
      "Berücksichtige strikt die erlaubten Varianten.",
      "Erlaubte Varianten:",
      variantContext || "- Keine spezielle Auswahl",
      "Nur die folgenden Rezept-IDs sind erlaubt (oder null verwenden):",
      recipeContext,
      "Antworte AUSSCHLIESSLICH als JSON im Format:",
      '{"kind":"MEAL_SUBSTITUTION|RECIPE_ADAPTATION","summary":"...","suggestions":[{"title":"...","recipeId":"..."|null,"rationale":"..."}]}',
      "Gib 3 Vorschläge aus.",
    ]
      .filter(Boolean)
      .join("\n\n");

    const rawText = await generateGeminiText({ prompt: aiPrompt, userId });
    const jsonText = extractJson(rawText);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      await prisma.aIInteraction.create({
        data: {
          userId,
          type: mode,
          request: requestSummary,
          error: "AI-Antwort konnte nicht als JSON gelesen werden.",
          response: rawText.slice(0, 4000),
        },
      });

      return respond(
        NextResponse.json(
          {
            error: "AI-Antwort konnte nicht als JSON gelesen werden.",
            raw: rawText.slice(0, 500),
          },
          { status: 502 },
        ),
        "AI-Antwort konnte nicht als JSON gelesen werden.",
      );
    }

    const validated = validateSuggestionPayload({
      payload: parsed,
      expectedMode: mode,
      allowedRecipeIds,
    });

    await prisma.aIInteraction.create({
      data: {
        userId,
        type: mode,
        request: requestSummary,
        response: JSON.stringify(validated).slice(0, 4000),
      },
    });

    return respond(
      NextResponse.json({
        data: validated,
        meta: {
          allowedRecipeCount: allowedRecipes.length,
          variantSelectionCount: selectedVariantOptionIds.length,
        },
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter AI-Fehler";

    await prisma.aIInteraction.create({
      data: {
        userId,
        type: "AI_ERROR",
        request: "POST /api/ai/meal-substitution",
        error: message,
      },
    });

    return respond(
      NextResponse.json({ error: message }, { status: 500 }),
      message,
    );
  }
}
