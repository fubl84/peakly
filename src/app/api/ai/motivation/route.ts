import { auth } from "@/auth";
import { generateGeminiText } from "@/lib/ai/gemini";
import {
  beginApiRequest,
  completeApiRequest,
  withRequestIdHeader,
} from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const MOTIVATION_LIMIT_WINDOW_MINUTES = 60;
const MOTIVATION_LIMIT_MAX_REQUESTS = 12;

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeWeek(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function buildPrompt(args: {
  week: number | null;
  trainingState: string;
  nutritionState: string;
  note: string;
}) {
  const { week, trainingState, nutritionState, note } = args;

  return [
    "Du bist ein motivierender Fitness-Coach für eine deutschsprachige App.",
    "Antwortvorgabe:",
    "- Sprache: Nur Deutsch",
    "- Ton: Positiv, klar, konkret",
    "- Länge: 2 bis 4 Sätze",
    "- Kein medizinischer Rat",
    week ? `Aktuelle Woche im Pfad: ${week}` : null,
    trainingState
      ? `Trainingsstatus: ${trainingState}`
      : "Trainingsstatus: nicht angegeben",
    nutritionState
      ? `Ernährungsstatus: ${nutritionState}`
      : "Ernährungsstatus: nicht angegeben",
    note ? `Zusatzkontext vom Nutzer: ${note}` : null,
    "Erzeuge genau eine kurze Motivation für heute.",
  ]
    .filter(Boolean)
    .join("\n");
}

function cleanMotivationText(value: string) {
  return value
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 700);
}

export async function POST(request: Request) {
  const ctx = beginApiRequest(request, "/api/ai/motivation");
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

  const windowStart = new Date(
    Date.now() - MOTIVATION_LIMIT_WINDOW_MINUTES * 60 * 1000,
  );

  const recentCount = await prisma.aIInteraction.count({
    where: {
      userId: session.user.id,
      type: "MOTIVATION",
      createdAt: { gte: windowStart },
    },
  });

  if (recentCount >= MOTIVATION_LIMIT_MAX_REQUESTS) {
    return respond(
      NextResponse.json(
        {
          error:
            "Rate-Limit erreicht. Bitte versuche es in einigen Minuten erneut.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": "300",
          },
        },
      ),
      "Rate-Limit erreicht",
    );
  }

  try {
    const body = (await request.json()) as {
      week?: unknown;
      trainingState?: unknown;
      nutritionState?: unknown;
      note?: unknown;
    };

    const week = normalizeWeek(body.week);
    const trainingState = normalizeText(body.trainingState);
    const nutritionState = normalizeText(body.nutritionState);
    const note = normalizeText(body.note);

    const requestSummary = JSON.stringify({
      week,
      trainingState,
      nutritionState,
      note,
    }).slice(0, 4000);

    const text = await generateGeminiText({
      prompt: buildPrompt({ week, trainingState, nutritionState, note }),
      userId,
    });

    const message = cleanMotivationText(text);

    await prisma.aIInteraction.create({
      data: {
        userId,
        type: "MOTIVATION",
        request: requestSummary,
        response: message,
      },
    });

    return respond(
      NextResponse.json({
        data: {
          message,
        },
        meta: {
          limitWindowMinutes: MOTIVATION_LIMIT_WINDOW_MINUTES,
          limitMaxRequests: MOTIVATION_LIMIT_MAX_REQUESTS,
          usedInWindow: recentCount + 1,
        },
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Motivations-Fehler";

    await prisma.aIInteraction.create({
      data: {
        userId,
        type: "MOTIVATION_ERROR",
        request: "POST /api/ai/motivation",
        error: message,
      },
    });

    return respond(
      NextResponse.json({ error: message }, { status: 500 }),
      message,
    );
  }
}
