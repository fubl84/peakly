import { auth } from "@/auth";
import { generateGeminiText } from "@/lib/ai/gemini";
import { getShoppingCategoryLabel } from "@/lib/shopping-categories";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

type ShoppingItem = {
  id: string;
  label: string;
  amount: number | null;
  unit: string | null;
  category: string;
};

function normalizeCleanupLabel(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

function normalizeCleanupUnit(unit: string | null) {
  if (!unit) return "";
  return unit.trim().toLowerCase();
}

function mergeKey(item: ShoppingItem) {
  return `${normalizeCleanupLabel(item.label)}::${normalizeCleanupUnit(item.unit)}`;
}

function toWeek(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { week?: unknown };
    const week = toWeek(body.week);

    if (!week) {
      return NextResponse.json({ error: "Ungültige Woche." }, { status: 400 });
    }

    const activePairLink = await prisma.userPairLink.findFirst({
      where: {
        status: "ACTIVE",
        OR: [{ initiatorId: session.user.id }, { inviteeId: session.user.id }],
      },
      select: {
        initiatorId: true,
      },
    });

    const ownerUserId = activePairLink
      ? activePairLink.initiatorId
      : session.user.id;

    const ownerEnrollment = await prisma.userPathEnrollment.findFirst({
      where: { userId: ownerUserId, isActive: true },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (!ownerEnrollment) {
      return NextResponse.json(
        { error: "Keine aktive Teilnahme für Listen-Owner gefunden." },
        { status: 400 },
      );
    }

    const shoppingList = await prisma.userShoppingList.findUnique({
      where: {
        enrollmentId_week: {
          enrollmentId: ownerEnrollment.id,
          week,
        },
      },
      include: {
        items: {
          select: {
            id: true,
            label: true,
            amount: true,
            unit: true,
            category: true,
          },
          orderBy: [{ isChecked: "asc" }, { label: "asc" }],
        },
      },
    });

    const items = (shoppingList?.items ?? []) as ShoppingItem[];

    const groups = new Map<string, ShoppingItem[]>();
    for (const item of items) {
      const key = mergeKey(item);
      const current = groups.get(key) ?? [];
      current.push(item);
      groups.set(key, current);
    }

    const mergedItemCount = groups.size;

    const categoryCountMap = new Map<string, number>();
    for (const item of items) {
      const key = item.category || "other";
      categoryCountMap.set(key, (categoryCountMap.get(key) ?? 0) + 1);
    }

    const categoryGroups = Array.from(categoryCountMap.entries())
      .map(([category, count]) => ({
        category: getShoppingCategoryLabel(category),
        count,
      }))
      .sort((a, b) => b.count - a.count);

    let aiSummary =
      "Die Liste kann zusammengeführt und besser nach Kategorien strukturiert werden.";

    if (items.length > 0) {
      try {
        const prompt = [
          "Du bist ein deutschsprachiger Einkaufsassistent.",
          `Aktuell: ${items.length} Einträge, nach Merge: ${mergedItemCount}.`,
          "Kategorien:",
          ...categoryGroups.map(
            (group) => `- ${group.category}: ${group.count}`,
          ),
          "Schreibe eine kurze 2-3 Satz Empfehlung für den Cleanup.",
        ].join("\n");

        aiSummary = (
          await generateGeminiText({ prompt, userId: session.user.id })
        )
          .trim()
          .slice(0, 500);
      } catch {
        // fallback summary stays active
      }
    }

    return NextResponse.json({
      data: {
        mergedItemCount,
        beforeItemCount: items.length,
        categoryGroups,
        aiSummary,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unbekannter Cleanup-Vorschau-Fehler";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
