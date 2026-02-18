import { requireAuth } from "@/lib/access";
import { generateGeminiText } from "@/lib/ai/gemini";
import Link from "next/link";

type SearchParamValue = string | string[] | undefined;

type AiPageProps = {
  searchParams?: Promise<Record<string, SearchParamValue>>;
};

function toSingle(value: SearchParamValue) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

export default async function AiPage(props: AiPageProps) {
  const session = await requireAuth();
  const params = (await props.searchParams) ?? {};
  const prompt = toSingle(params.prompt).trim();

  let result:
    | { text: string; error: null }
    | { text: null; error: string }
    | null = null;

  if (prompt) {
    try {
      const text = await generateGeminiText({
        prompt: `Du bist ein Fitness- und Ernährungsassistent für eine deutschsprachige App. Antworte kurz, klar und auf Deutsch.\n\nNutzerfrage:\n${prompt}`,
        userId: session.user.id,
      });
      result = { text, error: null };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unbekannter AI-Fehler.";
      result = { text: null, error: message };
    }
  }

  return (
    <main className="dashboard-page">
      <h1 className="page-title">AI Assistent (Gemini)</h1>
      <Link className="back-link" href="/dashboard">
        Zurück zum Dashboard
      </Link>

      <section className="card stack">
        <h2 className="section-title">Teste deine Anfrage</h2>
        <p className="muted">
          Diese Seite validiert die Gemini-Integration (E-01) inkl.
          Fehlerbehandlung.
        </p>
        <form className="form-grid">
          <textarea
            name="prompt"
            defaultValue={prompt}
            rows={5}
            placeholder="z. B. Gib mir eine kurze Idee für eine proteinreiche Lunch-Alternative."
            required
          />
          <button type="submit">Antwort generieren</button>
        </form>
      </section>

      {result ? (
        <section className="card stack">
          <h2 className="section-title">Antwort</h2>
          {result.error ? (
            <p className="error-text" style={{ whiteSpace: "pre-wrap" }}>
              {result.error}
            </p>
          ) : (
            <p style={{ whiteSpace: "pre-wrap" }}>{result.text}</p>
          )}
        </section>
      ) : null}
    </main>
  );
}
