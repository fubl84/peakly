"use client";

import { PlayCircle, X } from "lucide-react";
import { useMemo, useState } from "react";

type ExerciseVideoPreviewButtonProps = {
  exerciseName: string;
  mediaUrl: string | null;
  compact?: boolean;
};

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

export function ExerciseVideoPreviewButton({
  exerciseName,
  mediaUrl,
  compact = false,
}: ExerciseVideoPreviewButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const embedUrl = useMemo(
    () => (mediaUrl ? toYoutubeEmbed(mediaUrl) : null),
    [mediaUrl],
  );

  if (!mediaUrl) {
    return <span className="muted">Kein Vorschauvideo</span>;
  }

  return (
    <>
      <button
        type="button"
        className={compact ? "training-secondary-button" : "week-nav-button"}
        onClick={() => setIsOpen(true)}
      >
        <PlayCircle size={16} aria-hidden="true" /> Vorschau
      </button>

      {isOpen ? (
        <div
          className="path-modal-overlay"
          role="presentation"
          onClick={(event) => {
            if (event.currentTarget === event.target) {
              setIsOpen(false);
            }
          }}
        >
          <section className="path-modal" role="dialog" aria-modal="true">
            <header className="path-modal-head">
              <div className="path-modal-title-wrap">
                <span className="path-product-chip">Exercise Video</span>
                <h3 className="path-modal-title">{exerciseName}</h3>
              </div>
              <button
                type="button"
                className="path-modal-close"
                onClick={() => setIsOpen(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>

            {embedUrl ? (
              <iframe
                className="workout-video-embed"
                src={embedUrl}
                title={`Video: ${exerciseName}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : mediaUrl ? (
              <video className="workout-video-embed" src={mediaUrl} controls />
            ) : null}

            <a href={mediaUrl} target="_blank" rel="noreferrer">
              Video in neuem Tab öffnen
            </a>
          </section>
        </div>
      ) : null}
    </>
  );
}
