import { auth } from "@/auth";
import { getDashboardInsightsForUser } from "@/lib/dashboard-insights";
import {
  beginApiRequest,
  completeApiRequest,
  withRequestIdHeader,
} from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

function normalizeForceRefresh(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes";
  }

  return false;
}

export async function GET(request: Request) {
  const ctx = beginApiRequest(request, "/api/ai/dashboard-insights");
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
    const data = await getDashboardInsightsForUser({ userId, forceRefresh: false });

    await prisma.aIInteraction.create({
      data: {
        userId,
        type: "DASHBOARD_INSIGHTS_GET",
        request: JSON.stringify({ forceRefresh: false }).slice(0, 4000),
        response: JSON.stringify({ week: data.week, cards: data.cards.length }).slice(0, 4000),
      },
    });

    return respond(NextResponse.json({ data }));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Dashboard-Insights-Fehler";

    await prisma.aIInteraction.create({
      data: {
        userId,
        type: "DASHBOARD_INSIGHTS_GET_ERROR",
        request: "GET /api/ai/dashboard-insights",
        error: message,
      },
    });

    return respond(NextResponse.json({ error: message }, { status: 500 }), message);
  }
}

export async function POST(request: Request) {
  const ctx = beginApiRequest(request, "/api/ai/dashboard-insights");
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
      forceRefresh?: unknown;
    };

    const forceRefresh = normalizeForceRefresh(body.forceRefresh);
    const data = await getDashboardInsightsForUser({ userId, forceRefresh });

    await prisma.aIInteraction.create({
      data: {
        userId,
        type: "DASHBOARD_INSIGHTS_POST",
        request: JSON.stringify({ forceRefresh }).slice(0, 4000),
        response: JSON.stringify({ week: data.week, cards: data.cards.length }).slice(0, 4000),
      },
    });

    return respond(NextResponse.json({ data }));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unbekannter Dashboard-Insights-Fehler";

    await prisma.aIInteraction.create({
      data: {
        userId,
        type: "DASHBOARD_INSIGHTS_POST_ERROR",
        request: "POST /api/ai/dashboard-insights",
        error: message,
      },
    });

    return respond(NextResponse.json({ error: message }, { status: 500 }), message);
  }
}
