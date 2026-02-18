"use client";

import { useEffect, useMemo, useState } from "react";

type VideoAssetItem = {
  id: string;
  name: string;
  originalFileName: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

type AdminVideoSourceFieldProps = {
  fieldName: string;
  label: string;
  defaultValue?: string | null;
  youtubePlaceholder?: string;
};

function isInternalVideoUrl(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return value.startsWith("/uploads/videos/");
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function AdminVideoSourceField({
  fieldName,
  label,
  defaultValue,
  youtubePlaceholder = "https://...",
}: AdminVideoSourceFieldProps) {
  const [source, setSource] = useState<"YOUTUBE" | "INTERNAL">(
    isInternalVideoUrl(defaultValue ?? null) ? "INTERNAL" : "YOUTUBE",
  );
  const [value, setValue] = useState(defaultValue ?? "");
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name">("newest");
  const [assets, setAssets] = useState<VideoAssetItem[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.url === value) ?? null,
    [assets, value],
  );

  const sortedAssets = useMemo(() => {
    const items = [...assets];
    if (sortBy === "name") {
      return items.sort((a, b) => a.name.localeCompare(b.name, "de"));
    }

    if (sortBy === "oldest") {
      return items.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }

    return items.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [assets, sortBy]);

  function handleSourceChange(nextSource: "YOUTUBE" | "INTERNAL") {
    setSource(nextSource);
    if (nextSource === "YOUTUBE" && isInternalVideoUrl(value)) {
      setValue("");
    }
  }

  async function loadAssets() {
    setIsLoadingAssets(true);
    setLibraryError(null);

    try {
      const response = await fetch(
        `/api/admin/video-assets?query=${encodeURIComponent(searchValue)}`,
      );

      if (!response.ok) {
        throw new Error("Videoliste konnte nicht geladen werden.");
      }

      const payload = (await response.json()) as { assets?: VideoAssetItem[] };
      setAssets(payload.assets ?? []);
    } catch (error) {
      setLibraryError(
        error instanceof Error
          ? error.message
          : "Videoliste konnte nicht geladen werden.",
      );
    } finally {
      setIsLoadingAssets(false);
    }
  }

  useEffect(() => {
    if (!isLibraryOpen) {
      return;
    }

    void loadAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLibraryOpen]);

  return (
    <div className="field" style={{ gap: "0.5rem" }}>
      <span>{label}</span>
      <select
        value={source}
        onChange={(event) =>
          handleSourceChange(event.target.value as "YOUTUBE" | "INTERNAL")
        }
      >
        <option value="YOUTUBE">YouTube / externe URL</option>
        <option value="INTERNAL">Internes Video</option>
      </select>

      {source === "YOUTUBE" ? (
        <input
          name={fieldName}
          type="url"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={youtubePlaceholder}
        />
      ) : (
        <>
          <input type="hidden" name={fieldName} value={value} />
          {value ? (
            <p className="muted" style={{ margin: 0 }}>
              Gewählt: {selectedAsset?.name ?? value}
            </p>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              Noch kein internes Video ausgewählt.
            </p>
          )}
          <div
            className="admin-card-actions"
            style={{ justifyContent: "flex-start" }}
          >
            <button
              type="button"
              className="admin-secondary-button"
              onClick={() => setIsLibraryOpen(true)}
            >
              Video Library
            </button>
            {value ? (
              <button
                type="button"
                className="admin-secondary-button"
                onClick={() => setValue("")}
              >
                Auswahl entfernen
              </button>
            ) : null}
          </div>

          {selectedAsset ? (
            <div
              className="admin-list-card"
              style={{ background: "#fff", borderStyle: "solid" }}
            >
              <div className="admin-list-card-head">
                <div className="admin-list-title-wrap">
                  <h3 style={{ margin: 0 }}>Ausgewähltes internes Video</h3>
                  <p className="muted" style={{ margin: 0 }}>
                    {selectedAsset.name} ·{" "}
                    {formatBytes(selectedAsset.sizeBytes)} ·{" "}
                    {formatDate(selectedAsset.createdAt)}
                  </p>
                </div>
              </div>
              <video
                src={selectedAsset.url}
                controls
                preload="metadata"
                style={{
                  width: "100%",
                  borderRadius: "0.75rem",
                  marginTop: "0.5rem",
                }}
              />
            </div>
          ) : null}
        </>
      )}

      {isLibraryOpen ? (
        <div
          className="admin-modal-overlay"
          role="presentation"
          onClick={() => setIsLibraryOpen(false)}
        >
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => event.stopPropagation()}
            style={{ width: "min(860px, 100%)" }}
          >
            <div className="admin-modal-head">
              <h2>Video Library</h2>
              <button
                type="button"
                className="admin-icon-close"
                onClick={() => setIsLibraryOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="admin-list-stack">
              <section className="admin-list-card">
                <div
                  style={{
                    display: "grid",
                    gap: "0.5rem",
                    gridTemplateColumns: "minmax(0, 1fr) auto auto",
                  }}
                >
                  <input
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="Video suchen..."
                  />
                  <select
                    value={sortBy}
                    onChange={(event) =>
                      setSortBy(
                        event.target.value as "newest" | "oldest" | "name",
                      )
                    }
                    aria-label="Sortierung"
                  >
                    <option value="newest">Neueste</option>
                    <option value="oldest">Älteste</option>
                    <option value="name">Name A-Z</option>
                  </select>
                  <button
                    type="button"
                    className="admin-secondary-button"
                    onClick={() => void loadAssets()}
                    disabled={isLoadingAssets}
                  >
                    Suchen
                  </button>
                </div>

                {libraryError ? (
                  <p className="training-warning-banner">{libraryError}</p>
                ) : null}

                {isLoadingAssets ? (
                  <p className="muted">Lade Videos...</p>
                ) : assets.length === 0 ? (
                  <p className="muted">Keine Videos gefunden.</p>
                ) : (
                  <div
                    className="admin-list-stack"
                    style={{ marginTop: "0.5rem" }}
                  >
                    {sortedAssets.map((asset) => (
                      <article
                        key={asset.id}
                        className="admin-list-card"
                        style={{
                          background: "#fff",
                          borderColor:
                            asset.url === value ? "#4f46e5" : undefined,
                          borderWidth: asset.url === value ? "2px" : undefined,
                          borderStyle: "solid",
                        }}
                      >
                        <div className="admin-list-card-head">
                          <div className="admin-list-title-wrap">
                            <h3 style={{ margin: 0 }}>
                              {asset.name}
                              {asset.url === value ? " · ausgewählt" : ""}
                            </h3>
                            <p className="muted">
                              {asset.originalFileName} ·{" "}
                              {formatBytes(asset.sizeBytes)} · {asset.mimeType}{" "}
                              · {formatDate(asset.createdAt)}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="admin-secondary-button"
                            onClick={() => {
                              setValue(asset.url);
                              setSource("INTERNAL");
                              setIsLibraryOpen(false);
                            }}
                          >
                            Auswählen
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="admin-list-card">
                <h3 style={{ marginTop: 0 }}>Neues Video hochladen</h3>
                <div className="form-grid" style={{ maxWidth: "100%" }}>
                  <label className="field">
                    <span>Name (optional)</span>
                    <input
                      value={uploadName}
                      onChange={(event) => setUploadName(event.target.value)}
                      placeholder="z.B. Warmup Mobility 5min"
                    />
                  </label>

                  <label className="field">
                    <span>Videodatei</span>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0] ?? null;
                        setUploadFile(file);
                      }}
                    />
                  </label>

                  <button
                    type="button"
                    disabled={!uploadFile || isUploading}
                    onClick={async () => {
                      if (!uploadFile) {
                        return;
                      }

                      setIsUploading(true);
                      setLibraryError(null);

                      try {
                        const payload = new FormData();
                        payload.set("file", uploadFile);
                        if (uploadName.trim()) {
                          payload.set("name", uploadName.trim());
                        }

                        const response = await fetch(
                          "/api/admin/video-assets",
                          {
                            method: "POST",
                            body: payload,
                          },
                        );

                        if (!response.ok) {
                          const body = (await response.json()) as {
                            error?: string;
                          };
                          throw new Error(
                            body.error ?? "Upload fehlgeschlagen.",
                          );
                        }

                        const body = (await response.json()) as {
                          asset?: VideoAssetItem;
                        };
                        if (!body.asset) {
                          throw new Error("Upload fehlgeschlagen.");
                        }

                        setValue(body.asset.url);
                        setSource("INTERNAL");
                        setUploadFile(null);
                        setUploadName("");
                        setIsLibraryOpen(false);
                      } catch (error) {
                        setLibraryError(
                          error instanceof Error
                            ? error.message
                            : "Upload fehlgeschlagen.",
                        );
                      } finally {
                        setIsUploading(false);
                      }
                    }}
                  >
                    {isUploading ? "Lädt hoch..." : "Hochladen"}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
