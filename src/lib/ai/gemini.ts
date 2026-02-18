import { prisma } from "@/lib/prisma";

type GeminiGenerateTextArgs = {
  prompt: string;
  responseMimeType?: "text/plain" | "application/json";
  useWebSearch?: boolean;
  userId?: string;
};

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isTransientNetworkError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const text = error.message.toLowerCase();
  return (
    text.includes("incomplete envelope") ||
    text.includes("network") ||
    text.includes("socket") ||
    text.includes("fetch failed") ||
    text.includes("read tcp")
  );
}

async function readGeminiConfig(userId?: string) {
  const envApiKey = process.env.GEMINI_API_KEY?.trim();
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash";

  let userApiKey: string | null = null;
  if (userId) {
    const settings = await prisma.userSetting.findUnique({
      where: { userId },
      select: { geminiApiKey: true },
    });
    userApiKey = settings?.geminiApiKey?.trim() || null;
  }

  const apiKey = userApiKey || envApiKey;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY fehlt. Bitte in Einstellungen oder .env setzen, um AI-Funktionen zu nutzen.",
    );
  }

  return { apiKey, model };
}

function parseGeminiText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidateList = (payload as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidateList) || candidateList.length === 0) {
    return null;
  }

  const firstCandidate = candidateList[0] as {
    content?: { parts?: Array<{ text?: string }> };
  };

  const parts = firstCandidate.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    return null;
  }

  const text = parts
    .map((part: { text?: string }) =>
      typeof part.text === "string" ? part.text : "",
    )
    .join("\n")
    .trim();

  return text || null;
}

export async function generateGeminiText(args: GeminiGenerateTextArgs) {
  const prompt = args.prompt.trim();
  if (!prompt) {
    throw new Error("Prompt darf nicht leer sein.");
  }

  const responseMimeType = args.responseMimeType ?? "text/plain";
  const useWebSearch = args.useWebSearch ?? false;

  const { apiKey, model } = await readGeminiConfig(args.userId);
  const requestUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseMimeType,
    },
    ...(useWebSearch
      ? {
          tools: [{ google_search: {} }],
        }
      : {}),
  });

  let response: Response | null = null;
  let lastErrorMessage = "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await fetch(requestUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestBody,
        cache: "no-store",
      });
    } catch (error) {
      if (isTransientNetworkError(error) && attempt < 2) {
        await sleep(250 * (attempt + 1));
        continue;
      }

      throw new Error(
        "Gemini ist derzeit nicht erreichbar. Bitte später erneut versuchen.",
      );
    }

    if (response.ok) {
      break;
    }

    const errorPayload = await response.text();
    lastErrorMessage = `Gemini-Fehler (${response.status}). Antwort: ${errorPayload.slice(0, 220)}`;

    if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === 2) {
      throw new Error(lastErrorMessage);
    }

    await sleep(250 * (attempt + 1));
  }

  if (!response || !response.ok) {
    throw new Error(
      lastErrorMessage ||
        "Gemini ist derzeit nicht erreichbar. Bitte später erneut versuchen.",
    );
  }

  const payload = (await response.json()) as unknown;
  const text = parseGeminiText(payload);

  if (!text) {
    throw new Error("Gemini hat keine verwertbare Antwort geliefert.");
  }

  return text;
}
