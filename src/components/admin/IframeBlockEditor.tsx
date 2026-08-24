"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Block } from "@/types/project";
import { Input } from "@/components/Input";
import { Segmented } from "@/components/Segmented";
import { uploadFile, blockStoragePath } from "@/lib/storage";
import { PillButton } from "@/components/Button";

interface IframeBlockEditorProps {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
  projectSlug?: string;
}

function UploadZone({
  blockId,
  projectSlug,
  currentSrc,
  onUploaded,
}: {
  blockId: string;
  projectSlug: string;
  currentSrc?: string;
  onUploaded: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  useEffect(() => {
    if (currentSrc && !filename) {
      const parts = currentSrc.split("/");
      const raw = parts[parts.length - 1].split("?")[0];
      const match = raw.match(/^\d+_(.+)$/);
      setFilename(match ? match[1] : raw);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setProgress(0);
      setFilename(file.name);

      try {
        const path = blockStoragePath(projectSlug, blockId, file);
        const url = await uploadFile(file, path, (p) => setProgress(p));
        setProgress(null);
        onUploaded(url);
      } catch (err: unknown) {
        console.error("Upload error:", err);
        setError("Yükleme başarısız oldu.");
        setProgress(null);
      }
    },
    [blockId, projectSlug, onUploaded]
  );

  return (
    <div className="flex-1 flex flex-col gap-1.5">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <div className="flex items-center gap-2">
        <PillButton
          type="button"
          size="sm"
          variant="filled"
          onClick={() => fileRef.current?.click()}
        >
          {progress !== null ? `%${progress} Yükleniyor...` : currentSrc ? "Resmi Değiştir" : "Görsel Seç"}
        </PillButton>
        {filename && (
          <span className="text-xs text-[var(--text-subtitle)] font-mono truncate max-w-[200px]">
            {filename}
          </span>
        )}
      </div>
      {error && <span className="text-xs text-rose-500 font-mono">{error}</span>}
    </div>
  );
}

export function IframeBlockEditor({ block, onChange, projectSlug = "unknown" }: IframeBlockEditorProps) {
  const [coverTab, setCoverTab] = useState<"URL" | "Yükle">("URL");
  const [showAdvancedUrls, setShowAdvancedUrls] = useState(false);

  // Active views defaulting to all three enabled
  const activeViews: ("desktop" | "tablet" | "mobile")[] = block.iframeViews && block.iframeViews.length > 0
    ? block.iframeViews
    : ["desktop", "tablet", "mobile"];

  function toggleView(view: "desktop" | "tablet" | "mobile") {
    let updated: ("desktop" | "tablet" | "mobile")[];
    if (activeViews.includes(view)) {
      if (activeViews.length <= 1) return;
      updated = activeViews.filter((v) => v !== view);
    } else {
      const order: ("desktop" | "tablet" | "mobile")[] = ["desktop", "tablet", "mobile"];
      updated = order.filter((v) => v === view || activeViews.includes(v));
    }
    onChange({ iframeViews: updated });
  }

  function handleSrcChange(value: string) {
    const srcMatch = value.match(/src="([^"]+)"/);
    let url = (srcMatch ? srcMatch[1] : value).trim();

    if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }

    onChange({ src: url });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Responsive View Selection */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wider text-[var(--text-subtitle)] select-none">
          Aktif Responsive Görünümler
        </label>
        <div className="flex items-center gap-2">
          {(["desktop", "tablet", "mobile"] as const).map((view) => {
            const isActive = activeViews.includes(view);
            const labels = { desktop: "Desktop", tablet: "Tablet", mobile: "Mobile" };
            const icons = {
              desktop: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
              ),
              tablet: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
              ),
              mobile: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                  <line x1="12" y1="18" x2="12.01" y2="18" />
                </svg>
              ),
            };

            return (
              <button
                key={view}
                type="button"
                onClick={() => toggleView(view)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all duration-150 cursor-pointer ${
                  isActive
                    ? "border-[var(--border-hover)] bg-[var(--bg-2)] text-[var(--text-title)] shadow-sm"
                    : "border-[var(--border)] text-[var(--text-subtitle)] opacity-60 hover:opacity-100 hover:border-[var(--border-hover)]"
                }`}
              >
                {icons[view]}
                <span>{labels[view]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Custom Cover Image Section (Optional - defaults to live website preview) */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wider text-[var(--text-subtitle)] select-none">
          Özel Kapak Görseli (İsteğe Bağlı — Boş Bırakılırsa Canlı Önizleme Gösterilir)
        </label>

        <div className="flex items-center gap-[10px]">
          <Segmented
            options={["URL", "Yükle"]}
            value={coverTab}
            onChange={(v) => setCoverTab(v as "URL" | "Yükle")}
            size="md"
          />
          {coverTab === "URL" ? (
            <Input
              type="url"
              bgContext="block"
              value={block.iframeCover ?? ""}
              onChange={(e) => onChange({ iframeCover: e.target.value })}
              placeholder="Özel Kapak Resmi URL — https://..."
              size="md"
              className="flex-1"
            />
          ) : (
            <UploadZone
              blockId={block.id}
              projectSlug={projectSlug}
              currentSrc={block.iframeCover}
              onUploaded={(url: string) => onChange({ iframeCover: url })}
            />
          )}
        </div>
      </div>

      {/* 3. iFrame Main URL */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium uppercase tracking-wider text-[var(--text-subtitle)] select-none">
          Canlı iFrame URL
        </label>
        <Input
          type="text"
          bgContext="block"
          value={block.src ?? ""}
          onChange={(e) => handleSrcChange(e.target.value)}
          placeholder="Embed / Canlı Web Sitesi Linki (https://...)"
          size="md"
        />
      </div>

      {/* 4. Advanced: Device Specific URL overrides */}
      {(activeViews.includes("tablet") || activeViews.includes("mobile")) && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowAdvancedUrls(!showAdvancedUrls)}
            className="text-xs font-medium text-[var(--text-subtitle)] hover:text-[var(--text-title)] flex items-center gap-1.5 transition-colors cursor-pointer w-fit"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`transition-transform duration-200 ${showAdvancedUrls ? "rotate-90" : ""}`}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            Cihaza Özel Ayrı Link Gir (İsteğe Bağlı)
          </button>

          {showAdvancedUrls && (
            <div className="flex flex-col gap-2 pl-3 border-l border-[var(--border)] mt-1">
              {activeViews.includes("tablet") && (
                <Input
                  type="text"
                  bgContext="block"
                  value={block.iframeTabletUrl ?? ""}
                  onChange={(e) => onChange({ iframeTabletUrl: e.target.value.trim() })}
                  placeholder="Tablet Özel Linki (boş bırakılırsa ana link kullanılır)"
                  size="md"
                />
              )}
              {activeViews.includes("mobile") && (
                <Input
                  type="text"
                  bgContext="block"
                  value={block.iframeMobileUrl ?? ""}
                  onChange={(e) => onChange({ iframeMobileUrl: e.target.value.trim() })}
                  placeholder="Mobil Özel Linki (boş bırakılırsa ana link kullanılır)"
                  size="md"
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. Caption */}
      <Input
        type="text"
        bgContext="block"
        value={block.caption ?? ""}
        onChange={(e) => onChange({ caption: e.target.value })}
        placeholder="Açıklama — çerçevenin altında görünür (isteğe bağlı)"
        size="md"
      />
    </div>
  );
}
