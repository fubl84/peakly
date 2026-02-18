"use client";

import { Check, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  applyShoppingListCleanupAction,
  deleteShoppingListItemAction,
  toggleShoppingListItemAction,
} from "./actions";

type ShoppingListClientItem = {
  id: string;
  label: string;
  amountLabel: string | null;
  isChecked: boolean;
  category: string;
  createdByLabel: string | null;
};

type ShoppingListClientProps = {
  week: number;
  isSharedMode: boolean;
  items: ShoppingListClientItem[];
};

type CleanupPreview = {
  mergedItemCount: number;
  beforeItemCount: number;
  categoryGroups: Array<{
    category: string;
    count: number;
  }>;
  aiSummary: string;
};

type PriceOffer = {
  store: string;
  hasActiveOffer: boolean;
  price: string | null;
  unitPrice: string | null;
  validUntil: string | null;
  sourceUrl: string | null;
  snippet: string | null;
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

type PriceOfferPayload = {
  offers: PriceOffer[];
  summary: string;
  weekLabel: string;
  debug?: OfferSearchDebug;
};

const CATEGORY_ORDER = [
  "produce",
  "fruit",
  "dairy",
  "meat",
  "grains",
  "snacks",
  "drinks",
  "other",
] as const;

function categoryLabel(category: string) {
  if (category === "produce") return "Gemüse";
  if (category === "fruit") return "Obst";
  if (category === "dairy") return "Milchprodukte";
  if (category === "meat") return "Fleisch, Fisch & Eier";
  if (category === "grains") return "Getreide & Basics";
  if (category === "snacks") return "Snacks";
  if (category === "drinks") return "Getränke";
  return "Sonstiges";
}

export function ShoppingListClient({
  week,
  isSharedMode,
  items,
}: ShoppingListClientProps) {
  const [cleanupPreview, setCleanupPreview] = useState<CleanupPreview | null>(
    null,
  );
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupApplying, setCleanupApplying] = useState(false);

  const [priceModalItem, setPriceModalItem] =
    useState<ShoppingListClientItem | null>(null);
  const [priceOfferPayload, setPriceOfferPayload] =
    useState<PriceOfferPayload | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  const hasItems = items.length > 0;

  const groupedItems = useMemo(() => {
    const map = new Map<string, ShoppingListClientItem[]>();

    for (const item of items) {
      const category = item.category || "other";
      const list = map.get(category) ?? [];
      list.push(item);
      map.set(category, list);
    }

    return CATEGORY_ORDER.map((category) => ({
      category,
      label: categoryLabel(category),
      items: map.get(category) ?? [],
    })).filter((group) => group.items.length > 0);
  }, [items]);

  const suggestedTopItems = useMemo(() => {
    return items
      .filter((item) => item.label.trim().length > 0)
      .slice(0, 10)
      .map((item) => item.label);
  }, [items]);

  async function loadCleanupPreview() {
    setCleanupLoading(true);
    setCleanupError(null);

    try {
      const response = await fetch("/api/ai/shopping-list-cleanup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          week,
          suggestedTopItems,
        }),
      });

      const payload = (await response.json()) as {
        data?: CleanupPreview;
        error?: string;
      };

      if (!response.ok || !payload.data) {
        throw new Error(
          payload.error || "Cleanup-Vorschau konnte nicht geladen werden.",
        );
      }

      setCleanupPreview(payload.data);
    } catch (error) {
      setCleanupError(
        error instanceof Error ? error.message : "Unbekannter Vorschau-Fehler",
      );
    } finally {
      setCleanupLoading(false);
    }
  }

  async function applyCleanup(formData: FormData) {
    setCleanupApplying(true);

    try {
      await applyShoppingListCleanupAction(formData);
      setCleanupPreview(null);
      setCleanupError(null);
    } finally {
      setCleanupApplying(false);
    }
  }

  async function loadPriceOffers(item: ShoppingListClientItem) {
    setPriceModalItem(item);
    setPriceOfferPayload(null);
    setPriceError(null);
    setPriceLoading(true);

    try {
      const response = await fetch("/api/ai/shopping-price-offers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          label: item.label,
          amountLabel: item.amountLabel,
          city: "Hamburg",
          country: "Germany",
        }),
      });

      const payload = (await response.json()) as {
        data?: PriceOfferPayload;
        error?: string;
      };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error || "Preissuche fehlgeschlagen.");
      }

      setPriceOfferPayload(payload.data);
    } catch (error) {
      setPriceError(
        error instanceof Error ? error.message : "Unbekannter Preisfehler",
      );
    } finally {
      setPriceLoading(false);
    }
  }

  return (
    <section className="card stack">
      <h2 className="section-title">AI Helfer</h2>
      <p className="muted">
        Vorschau für Listen-Cleanup und KI-Angebotssuche je Artikel.
      </p>

      <div className="shopping-category-stack">
        <h3 className="section-title">Liste nach Kategorien</h3>
        {groupedItems.length === 0 ? (
          <p>Keine Einträge für diese Woche.</p>
        ) : (
          groupedItems.map((group) => (
            <article key={group.category} className="shopping-category-group">
              <header className="shopping-category-head">
                <h4>{group.label}</h4>
                <span className="calendar-day-tag">{group.items.length}</span>
              </header>

              <ul className="shopping-list-items">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <div className="shopping-item-row">
                      <form action={toggleShoppingListItemAction}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <button
                          type="submit"
                          className={`shopping-check-toggle ${
                            item.isChecked ? "is-checked" : ""
                          }`}
                          aria-label={
                            item.isChecked ? "Abhaken aufheben" : "Abhaken"
                          }
                        >
                          {item.isChecked ? (
                            <Check size={14} aria-hidden="true" />
                          ) : null}
                        </button>
                      </form>

                      <div className="shopping-item-label-wrap">
                        <span
                          className={`shopping-item-label${
                            item.isChecked ? " is-checked" : ""
                          }`}
                        >
                          {item.amountLabel
                            ? `${item.amountLabel} · ${item.label}`
                            : item.label}
                        </span>
                        {isSharedMode && item.createdByLabel ? (
                          <span className="shopping-item-creator-pill">
                            von {item.createdByLabel}
                          </span>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        className="shopping-price-button"
                        onClick={() => loadPriceOffers(item)}
                        aria-label={`Angebote suchen für ${item.label}`}
                        title="Angebote suchen"
                      >
                        <Search size={16} aria-hidden="true" />
                      </button>

                      <form action={deleteShoppingListItemAction}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <button
                          type="submit"
                          className="shopping-delete-button"
                          aria-label={`Eintrag entfernen: ${item.label}`}
                          title="Eintrag entfernen"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          ))
        )}
      </div>

      <div className="shopping-ai-actions">
        <button
          type="button"
          onClick={loadCleanupPreview}
          disabled={!hasItems || cleanupLoading}
        >
          {cleanupLoading ? "Lade Vorschau ..." : "Cleanup mit AI"}
        </button>
      </div>

      {cleanupError ? <p className="error-text">{cleanupError}</p> : null}

      {cleanupPreview ? (
        <article className="shopping-ai-preview">
          <p>
            <strong>{cleanupPreview.beforeItemCount}</strong> Einträge erkannt,
            nach Merge voraussichtlich{" "}
            <strong>{cleanupPreview.mergedItemCount}</strong> Einträge.
          </p>
          <p>{cleanupPreview.aiSummary}</p>
          <ul className="shopping-ai-preview-list">
            {cleanupPreview.categoryGroups.map((group) => (
              <li key={group.category}>
                {group.category}: {group.count}
              </li>
            ))}
          </ul>

          <div className="shopping-ai-actions">
            <form action={applyCleanup}>
              <input type="hidden" name="week" value={week} />
              <button type="submit" disabled={cleanupApplying}>
                {cleanupApplying ? "Wende Cleanup an ..." : "Cleanup anwenden"}
              </button>
            </form>
            <button
              type="button"
              className="training-secondary-button"
              onClick={() => setCleanupPreview(null)}
              disabled={cleanupApplying}
            >
              Abbrechen
            </button>
          </div>
        </article>
      ) : null}

      {priceModalItem ? (
        <div
          className="path-modal-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.currentTarget === event.target) {
              setPriceModalItem(null);
              setPriceOfferPayload(null);
              setPriceError(null);
            }
          }}
        >
          <section className="path-modal" role="dialog" aria-modal="true">
            <header className="path-modal-head">
              <div className="path-modal-title-wrap">
                <span className="path-product-chip">Preis-Scanner</span>
                <h3 className="path-modal-title">{priceModalItem.label}</h3>
              </div>
              <button
                type="button"
                className="path-modal-close"
                onClick={() => {
                  setPriceModalItem(null);
                  setPriceOfferPayload(null);
                  setPriceError(null);
                }}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            {priceLoading ? (
              <div className="shopping-offer-loading">
                <span className="shopping-spinner" aria-hidden="true" />
                <p>
                  KI sucht aktuelle Angebote. Das kann bis zu 1 Minute dauern.
                </p>
              </div>
            ) : null}
            {priceError ? <p className="error-text">{priceError}</p> : null}

            {priceOfferPayload ? (
              <>
                <p className="muted">
                  Aktuelle Woche: <strong>{priceOfferPayload.weekLabel}</strong>
                </p>
                <p>{priceOfferPayload.summary}</p>
                {priceOfferPayload.debug ? (
                  <details className="shopping-offer-debug">
                    <summary>Debug-Details</summary>
                    <ul>
                      <li>Model: {priceOfferPayload.debug.model}</li>
                      <li>
                        Grounded Web Search:{" "}
                        {priceOfferPayload.debug.usedWebSearch ? "ja" : "nein"}
                      </li>
                      <li>Parse-Modus: {priceOfferPayload.debug.parseMode}</li>
                      <li>
                        AI offers (roh): {priceOfferPayload.debug.aiOffersCount}
                      </li>
                      <li>
                        Aktive Offers (normalisiert):{" "}
                        {priceOfferPayload.debug.normalizedActiveOfferCount}
                      </li>
                      <li>
                        Web-Search-Fehler:{" "}
                        {priceOfferPayload.debug.webSearchError ??
                          "kein Fehler"}
                      </li>
                    </ul>
                    <p className="muted">
                      AI-Vorschau: {priceOfferPayload.debug.aiTextPreview}
                    </p>
                  </details>
                ) : null}
                <ul className="shopping-offer-list">
                  {priceOfferPayload.offers.map((offer) => (
                    <li key={offer.store}>
                      <p>
                        <strong>{offer.store}</strong> ·{" "}
                        {offer.hasActiveOffer
                          ? (offer.price ?? "Aktiv, Preis nicht klar")
                          : "Kein aktives Angebot"}
                      </p>
                      {offer.unitPrice ? (
                        <p className="muted">{offer.unitPrice}</p>
                      ) : null}
                      {offer.validUntil ? (
                        <p className="muted">Gültig bis: {offer.validUntil}</p>
                      ) : null}
                      {offer.snippet ? (
                        <p className="muted">{offer.snippet}</p>
                      ) : null}
                      {offer.sourceUrl ? (
                        <a
                          href={offer.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Quelle öffnen
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}
