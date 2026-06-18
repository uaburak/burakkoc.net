"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Block } from "@/types/project";
import { Input } from "@/components/Input";
import { uploadFile, blockStoragePath } from "@/lib/storage";
import { PillButton } from "@/components/Button";
import { Segmented } from "@/components/Segmented";

interface FigmaBlockEditorProps {
  block: Block;
  onChange: (updates: Partial<Block>) => void;
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
  onUploaded: (url: string, filename: string) => void;
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

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Sadece resim dosyaları yüklenebilir.");
      return;
    }
    setError(null);
    setProgress(0);
    try {
      const path = blockStoragePath(projectSlug, blockId, file);
      const url = await uploadFile(file, path, setProgress);
      setFilename(file.name);
      onUploaded(url, file.name);
    } catch (e) {
      setError("Yükleme başarısız oldu.");
      console.error(e);
    } finally {
      setProgress(null);
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockId, projectSlug]);

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <PillButton
        size="md"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        startIcon={
          progress !== null ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="30 70" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          )
        }
      >
        {progress !== null ? `${progress}%` : "Dosya Seç"}
      </PillButton>

      {filename && progress === null && (
        <span className="text-[13px] text-[var(--text-subtitle)] truncate min-w-0 flex-1 select-none">
          {filename}
        </span>
      )}

      {error && <span className="text-[12px] text-red-500 select-none truncate">{error}</span>}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function FigmaBlockEditor({ block, onChange, projectSlug = "unknown" }: FigmaBlockEditorProps) {
  const [protoTab, setProtoTab] = useState<"URL" | "Yükle">("URL");
  const [workspaceTab, setWorkspaceTab] = useState<"URL" | "Yükle">("URL");

  function handleSrcChange(value: string) {
    const srcMatch = value.match(/src="([^"]+)"/);
    const url = srcMatch ? srcMatch[1] : value;
    onChange({ src: url.trim() });
  }

  function handleWorkspaceChange(value: string) {
    const srcMatch = value.match(/src="([^"]+)"/);
    const url = srcMatch ? srcMatch[1] : value;
    onChange({ figmaWorkspace: url.trim() });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Prototip Bölümü */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-[10px]">
          <Segmented
            options={["URL", "Yükle"]}
            value={protoTab}
            onChange={(v) => setProtoTab(v as "URL" | "Yükle")}
            size="md"
          />
          {protoTab === "URL" ? (
            <Input
              type="url"
              value={block.figmaCover ?? ""}
              onChange={(e) => onChange({ figmaCover: e.target.value })}
              placeholder="Prototip Kapak Resmi URL - https://..."
              size="md"
              className="flex-1"
            />
          ) : (
            <UploadZone
              blockId={block.id}
              projectSlug={projectSlug}
              currentSrc={block.figmaCover}
              onUploaded={(url) => onChange({ figmaCover: url })}
            />
          )}
        </div>
        <Input
          type="text"
          value={block.src ?? ""}
          onChange={(e) => handleSrcChange(e.target.value)}
          placeholder="Figma prototip linki (https://www.figma.com/proto/...)"
          size="md"
        />
      </div>

      {/* Pages Bölümü */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-[10px]">
          <Segmented
            options={["URL", "Yükle"]}
            value={workspaceTab}
            onChange={(v) => setWorkspaceTab(v as "URL" | "Yükle")}
            size="md"
          />
          {workspaceTab === "URL" ? (
            <Input
              type="url"
              value={block.figmaWorkspaceCover ?? ""}
              onChange={(e) => onChange({ figmaWorkspaceCover: e.target.value })}
              placeholder="Pages Kapak Resmi URL - https://..."
              size="md"
              className="flex-1"
            />
          ) : (
            <UploadZone
              blockId={block.id}
              projectSlug={projectSlug}
              currentSrc={block.figmaWorkspaceCover}
              onUploaded={(url) => onChange({ figmaWorkspaceCover: url })}
            />
          )}
        </div>
        <Input
          type="text"
          value={block.figmaWorkspace ?? ""}
          onChange={(e) => handleWorkspaceChange(e.target.value)}
          placeholder="Figma Pages linki (https://www.figma.com/design/...)"
          size="md"
        />
      </div>

      <Input
        type="text"
        value={block.caption ?? ""}
        onChange={(e) => onChange({ caption: e.target.value })}
        placeholder="Açıklama — prototipin altında görünür (isteğe bağlı)"
        size="md"
      />
    </div>
  );
}
