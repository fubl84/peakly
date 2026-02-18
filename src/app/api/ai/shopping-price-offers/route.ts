import { auth } from "@/auth";
import { generateGeminiText } from "@/lib/ai/gemini";
import { NextResponse } from "next/server";

type Offer = {
  store: string;
  hasActiveOffer: boolean;
  price: string | null;
  unitPrice: string | null;
  validUntil: string | null;
  sourceUrl: string | null;
  snippet: string | null;
};

type ParsedAiResponse = {
  offers?: Array<{
    store?: unknown;
    hasActiveOffer?: unknown;
    price?: unknown;
    unitPrice?: unknown;
    validUntil?: unknown;
    sourceUrl?: unknown;
    snippet?: unknown;
  }>;
  summary?: unknown;
};

type OfferSearchDebug = {
  model: string;
  usedWebSearch: boolean;
  webSearchError: string | null;
  parseMode: "direct" | "extracted" | "none";
  aiTextPreview: string;
  aiOffersCount: number;
  normalizedActiveOfferCount: number;
};

const SUPPORTED_STORES = [
  "REWE",
  "EDEKA",
  "Kaufland",
  "Aldi",
  "Netto",
  "Penny",
  "LIDL",
] as const;

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function inferHasActiveOffer(args: {
  hasActiveOfferRaw: unknown;
  price: string | null;
  snippet: string | null;
}) {
  if (typeof args.hasActiveOfferRaw === "boolean") {
    return args.hasActiveOfferRaw;
  }

  if (typeof args.hasActiveOfferRaw === "string") {
    const normalized = args.hasActiveOfferRaw.trim().toLowerCase();
    if (["true", "ja", "yes", "active", "aktiv"].includes(normalized)) {
      return true;
    }
    if (["false", "nein", "no", "inactive", "inaktiv"].includes(normalized)) {
      return false;
    }
  }

  if (args.price) {
    return true;
  }

  if (args.snippet) {
    const low = args.snippet.toLowerCase();
    if (
      low.includes("kein aktives angebot") ||
      low.includes("no active offer")
    ) {
      return false;
    }

    return true;
  }

  return false;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function getCurrentWeekLabel(today = new Date()) {
  const monday = new Date(today);
  const dayOfWeek = (today.getDay() + 6) % 7;
  monday.setDate(today.getDate() - dayOfWeek);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return `${formatDate(monday)} - ${formatDate(sunday)}`;
}

function extractJsonBlock(value: string) {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");

  if (start < 0 || end < start) {
    return value;
  }

  return value.slice(start, end + 1);
}

function tryParseJson<T>(value: string) {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function defaultOffer(store: string) {
  return {
    store,
    hasActiveOffer: false,
    price: null,
    unitPrice: null,
    validUntil: null,
    sourceUrl: null,
    snippet: "Kein aktives Angebot für die aktuelle Woche gefunden.",
  } satisfies Offer;
}

function sanitizeOffers(raw: ParsedAiResponse["offers"]) {
  const byStore = new Map<string, Offer>();
  for (const store of SUPPORTED_STORES) {
    byStore.set(store.toLowerCase(), defaultOffer(store));
  }

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") {
        continue;
      }

      const storeRaw = normalizeText(entry.store);
      if (!storeRaw) {
        continue;
      }

      const matchedStore = SUPPORTED_STORES.find(
        (store) => store.toLowerCase() === storeRaw.toLowerCase(),
      );
      if (!matchedStore) {
        continue;
      }

      byStore.set(matchedStore.toLowerCase(), {
        store: matchedStore,
        price: normalizeText(entry.price) || null,
        unitPrice: normalizeText(entry.unitPrice) || null,
        validUntil: normalizeText(entry.validUntil) || null,
        sourceUrl: normalizeText(entry.sourceUrl) || null,
        snippet: normalizeText(entry.snippet) || null,
        hasActiveOffer: inferHasActiveOffer({
          hasActiveOfferRaw: entry.hasActiveOffer,
          price: normalizeText(entry.price) || null,
          snippet: normalizeText(entry.snippet) || null,
        }),
      });
    }
  }

  return SUPPORTED_STORES.map((store) => byStore.get(store.toLowerCase())!);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const body = (await request.json()) as {
      label?: unknown;
      amountLabel?: unknown;
      city?: unknown;
      country?: unknown;
    };

    const label = normalizeText(body.label);
    const amountLabel = normalizeText(body.amountLabel);
    const city = normalizeText(body.city) || "Hamburg";
    const country = normalizeText(body.country) || "Germany";
    const weekLabel = getCurrentWeekLabel();

    if (!label) {
      return NextResponse.json(
        { error: "Artikelbezeichnung fehlt." },
        { status: 400 },
      );
    }

    const query = amountLabel ? `${label} (${amountLabel})` : label;
    const model = process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash";
    const prompt = [
      "Du bist ein deutscher Angebots-Scout.",
      `Heute ist die aktuelle Woche: ${weekLabel}.`,
      `Aufgabe: Finde aktuelle Angebote fuer ${query} in ${city}, ${country}.`,
      `Pruefe exakt diese Stores: ${SUPPORTED_STORES.join(", ")}.`,
      "Gib alle Stores zurueck, auch wenn kein Angebot aktiv ist.",
      "Wenn unsicher oder Daten nicht bestaetigt: hasActiveOffer=false und price=null.",
      "Antworte ausschliesslich als valides JSON ohne Markdown.",
      "Format:",
      '{"offers":[{"store":"REWE","hasActiveOffer":true,"price":"0,99 €","unitPrice":"1,98 €/L","validUntil":"22.02.2026","sourceUrl":"https://...","snippet":"Monster Energy 0,5l Dose"}],"summary":"Kurze Zusammenfassung mit Bestpreis und Hinweis auf Unsicherheit"}',
      "Falls kein Angebot: hasActiveOffer=false, price=null, unitPrice=null, validUntil=null.",
      "summary soll maximal 3 kurze Saetze enthalten.",
    ].join("\n");

    let usedWebSearch = false;
    let webSearchError: string | null = null;
    let aiText: string;
    try {
      aiText = await generateGeminiText({
        prompt,
        responseMimeType: "text/plain",
        useWebSearch: true,
        userId,
      });
      usedWebSearch = true;
    } catch (error) {
      webSearchError =
        error instanceof Error ? error.message : "Web search call failed";
      aiText = await generateGeminiText({
        prompt,
        responseMimeType: "application/json",
        userId,
      });
    }

    const parsedDirect = tryParseJson<ParsedAiResponse>(aiText);
    const parsedExtracted = parsedDirect
      ? null
      : tryParseJson<ParsedAiResponse>(extractJsonBlock(aiText));
    const parsed = parsedDirect ?? parsedExtracted;
    const parseMode: OfferSearchDebug["parseMode"] = parsedDirect
      ? "direct"
      : parsedExtracted
        ? "extracted"
        : "none";

    if (!parsed) {
      return NextResponse.json(
        { error: "KI-Antwort konnte nicht als JSON gelesen werden." },
        { status: 502 },
      );
    }

    const offers = sanitizeOffers(parsed.offers);
    const summary =
      normalizeText(parsed.summary) ||
      "Keine belastbare Zusammenfassung verfügbar.";

    const debug: OfferSearchDebug = {
      model,
      usedWebSearch,
      webSearchError,
      parseMode,
      aiTextPreview: aiText.slice(0, 400),
      aiOffersCount: Array.isArray(parsed.offers) ? parsed.offers.length : 0,
      normalizedActiveOfferCount: offers.filter((offer) => offer.hasActiveOffer)
        .length,
    };

    return NextResponse.json({
      data: {
        offers,
        summary,
        weekLabel,
        debug,
      },
      meta: {
        note: "Antwort basiert auf KI-Recherche und kann je nach Datenlage variieren.",
        disclaimer: "Bitte Flyer/Shopseite vor Kauf kurz verifizieren.",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unbekannter KI-Angebotssuche-Fehler";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
