"use client";

import { markInfoBlockAsReadAction } from "@/app/dashboard/_actions/info-blocks";
import { X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

type InfoBlockFeedItem = {
  id: string;
  name: string;
  contentHtml: string;
  videoUrl: string | null;
  isUnread: boolean;
};

type InfoBlockFeedProps = {
  blocks: InfoBlockFeedItem[];
  variant: "banner" | "card";
  title?: string;
};

function previewText(value: string, maxLength = 220) {
  const plain = value
    .replace(/[#>*_`~\[\]()!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain) {
    return "Kein Inhalt verfügbar.";
  }

  if (plain.length <= maxLength) {
    return plain;
  }

  return `${plain.slice(0, maxLength).trim()}…`;
}

function toYoutubeEmbed(url: string) {
  const trimmed = url.trim();
  const watchMatch = trimmed.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{6,})/i,
  );
  if (!watchMatch?.[1]) {
    return null;
  }

  return `https://www.youtube.com/embed/${watchMatch[1]}`;
}

export function InfoBlockFeed({ blocks, variant, title }: InfoBlockFeedProps) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [locallyReadIds, setLocallyReadIds] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  const selectedBlock = useMemo(
    () => blocks.find((block) => block.id === selectedBlockId) ?? null,
    [blocks, selectedBlockId],
  );
  const selectedVideoEmbedUrl = useMemo(
    () =>
      selectedBlock?.videoUrl ? toYoutubeEmbed(selectedBlock.videoUrl) : null,
    [selectedBlock],
  );

  if (blocks.length === 0) {
    return null;
  }

  return (
    <section
      className={variant === "banner" ? "card stack" : "card stack"}
      style={
        variant === "banner"
          ? { borderLeft: "4px solid var(--color-accent)" }
          : undefined
      }
    >
      {title ? <h2 className="section-title">{title}</h2> : null}
      <div className="admin-list-stack" style={{ marginTop: 0 }}>
        {blocks.map((block) => {
          const isUnread = block.isUnread && !locallyReadIds.includes(block.id);

          return (
            <article
              key={block.id}
              className={
                variant === "banner"
                  ? "training-warning-banner"
                  : "admin-list-card"
              }
              style={
                isUnread
                  ? {
                      borderLeft: "4px solid #16a34a",
                      background: "rgba(22, 163, 74, 0.08)",
                    }
                  : undefined
              }
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <strong>{block.name}</strong>
                {isUnread ? <span className="role-pill">Neu</span> : null}
              </div>
              <p className="muted" style={{ marginBottom: "0.5rem" }}>
                {previewText(
                  block.contentHtml,
                  variant === "banner" ? 160 : 220,
                )}
              </p>
              <button
                type="button"
                className="training-secondary-button"
                onClick={() => {
                  setSelectedBlockId(block.id);

                  if (isUnread) {
                    setLocallyReadIds((current) => [...current, block.id]);
                    startTransition(async () => {
                      try {
                        await markInfoBlockAsReadAction(block.id);
                      } catch {
                        // keep UX responsive even if marking read fails
                      }
                    });
                  }
                }}
              >
                Vollständig lesen
              </button>
            </article>
          );
        })}
      </div>

      {selectedBlock ? (
        <div
          className="path-modal-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.currentTarget === event.target) {
              setSelectedBlockId(null);
            }
          }}
        >
          <section className="path-modal" role="dialog" aria-modal="true">
            <header className="path-modal-head">
              <div className="path-modal-title-wrap">
                <span className="path-product-chip">Info</span>
                <h3 className="path-modal-title">{selectedBlock.name}</h3>
              </div>
              <button
                type="button"
                className="path-modal-close"
                onClick={() => setSelectedBlockId(null)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            <div style={{ whiteSpace: "pre-wrap" }}>
              {selectedBlock.contentHtml}
            </div>

            {selectedBlock.videoUrl ? (
              <section className="stack" style={{ marginTop: "1rem" }}>
                <h4 className="section-title" style={{ marginBottom: 0 }}>
                  Video
                </h4>
                {selectedVideoEmbedUrl ? (
                  <iframe
                    className="workout-video-embed"
                    src={selectedVideoEmbedUrl}
                    title={`Video: ${selectedBlock.name}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : selectedBlock.videoUrl ? (
                  <video
                    className="workout-video-embed"
                    src={selectedBlock.videoUrl}
                    controls
                  />
                ) : null}
                <a
                  href={selectedBlock.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Video in neuem Tab öffnen
                </a>
              </section>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}
