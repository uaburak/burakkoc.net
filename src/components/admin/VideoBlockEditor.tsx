"use client";

import { Block } from "@/types/project";
import { BadgesEditor } from "@/components/admin/BadgesEditor";
import { Input } from "@/components/Input";
import { Segmented } from "@/components/Segmented";

const PLAYBACK_MODES = ["Oynatıcı", "Döngü"];

interface VideoBlockEditorProps {
  block: Block;
  onChange: (updates: Partial<Block>) => void;
}

export function VideoBlockEditor({ block, onChange }: VideoBlockEditorProps) {
  return (
    <div className="flex flex-col gap-3">
      <Input
        type="url"
        bgContext="block"
        value={block.src ?? ""}
        onChange={(e) => onChange({ src: e.target.value })}
        placeholder="Video URL — YouTube, Vimeo veya .mp4 / .webm"
        size="md"
      />
      <Input
        type="text"
        bgContext="block"
        value={block.caption ?? ""}
        onChange={(e) => onChange({ caption: e.target.value })}
        placeholder="Açıklama — videonun altında görünür"
        size="md"
      />
      {/* Döngü: sessiz, otomatik, kontrolsüz — arayüz animasyonları için GIF yerine. Yalnızca .mp4 / .webm */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-[var(--text-subtitle)] select-none">
          Oynatma — döngü yalnızca .mp4 / .webm dosyalarında
        </span>
        <Segmented
          options={PLAYBACK_MODES}
          value={block.videoLoop ? "Döngü" : "Oynatıcı"}
          onChange={(v) => onChange({ videoLoop: v === "Döngü" })}
          size="md"
        />
      </div>
      <BadgesEditor
        badges={block.badges ?? []}
        onChange={(badges) => onChange({ badges })}
      />
    </div>
  );
}
