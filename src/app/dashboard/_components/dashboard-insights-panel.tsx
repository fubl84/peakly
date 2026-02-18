"use client";

import { Bot, Link2, RefreshCcw, Target, TrendingUp, Zap } from "lucide-react";
import { useMemo, useState } from "react";

type InsightKey = "TODAY_FOCUS" | "GOAL_FEEDBACK" | "PLAN_SYNC" | "MOMENTUM";

type InsightCard = {
  key: InsightKey;
  title: string;
  content: string;
  generatedAt: string;
  expiresAt: string;
  fromCache: boolean;
};

type DashboardInsightsPanelProps = {
  initialCards: InsightCard[];
  initialError?: string | null;
};

function iconForInsight(key: InsightKey) {
  if (key === "TODAY_FOCUS") {
    return <Target size={16} aria-hidden="true" />;
  }
  if (key === "GOAL_FEEDBACK") {
    return <TrendingUp size={16} aria-hidden="true" />;
  }
  if (key === "PLAN_SYNC") {
    return <Link2 size={16} aria-hidden="true" />;
  }
  return <Zap size={16} aria-hidden="true" />;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function DashboardInsightsPanel({
  initialCards,
  initialError,
}: DashboardInsightsPanelProps) {
  const [cards, setCards] = useState<InsightCard[]>(initialCards);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  const hasCards = useMemo(() => cards.length > 0, [cards]);

  async function refreshAll() {
    const confirmed = window.confirm(
      "Insights neu analysieren?\n\nDenk' dran, dass jeder Refresh Geld kostet :)",
    );
    if (!confirmed) {
      return;
    }

    setError(null);
    setIsRefreshing(true);

    try {
      const response = await fetch("/api/ai/dashboard-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ forceRefresh: true }),
      });

      const payload = (await response.json()) as {
        data?: {
          cards?: InsightCard[];
        };
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error || "Insights konnten nicht aktualisiert werden.",
        );
      }

      setCards(payload.data?.cards ?? []);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unbekannter Fehler beim Aktualisieren.",
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <section className="card stack dashboard-insights-panel">
      <header className="dashboard-insights-head">
        <div>
          <p className="dashboard-kicker">AI Assistenten</p>
          <h2 className="section-title">Dein täglicher Coaching-Stack</h2>
        </div>
        <button
          type="button"
          className="dashboard-insights-refresh"
          onClick={refreshAll}
          disabled={isRefreshing}
        >
          <RefreshCcw size={14} aria-hidden="true" />
          {isRefreshing ? "Aktualisiere ..." : "Neu analysieren"}
        </button>
      </header>

      {error ? <p className="error-text">{error}</p> : null}

      {!hasCards ? (
        <p className="muted">
          Noch keine Insights verfügbar. Prüfe deinen Gemini-Key in den
          Einstellungen.
        </p>
      ) : (
        <div className="dashboard-insight-grid">
          {cards.map((card) => (
            <article key={card.key} className="dashboard-insight-card">
              <header className="dashboard-insight-card-head">
                <span className="dashboard-insight-title-wrap">
                  {iconForInsight(card.key)}
                  <strong>{card.title}</strong>
                </span>
                <span className="dashboard-insight-cache-pill">
                  {card.fromCache ? "Cache" : "Live"}
                </span>
              </header>

              <p className="dashboard-insight-content">{card.content}</p>

              <footer className="dashboard-insight-meta">
                <Bot size={12} aria-hidden="true" />
                <span>
                  Generiert: {formatDateTime(card.generatedAt)} · Ablauf:{" "}
                  {formatDateTime(card.expiresAt)}
                </span>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
