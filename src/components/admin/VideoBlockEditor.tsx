"use client";

import { Block } from "@/types/project";
import { BadgesEditor } from "@/components/admin/BadgesEditor";
import { Input } from "@/components/Input";

interface VideoBlockEditorProps {
  block: Block;
  onChange: (updates: Partial<Block>) => void;
}

export function VideoBlockEditor({ block, onChange }: VideoBlockEditorProps) {
  return (
    <div className="flex flex-col gap-3">
      <Input
        type="url"
        value={block.src ?? ""}
        onChange={(e) => onChange({ src: e.target.value })}
        placeholder="Video URL — YouTube, Vimeo veya .mp4 / .webm"
        size="md"
      />
      <Input
        type="text"
        value={block.caption ?? ""}
        onChange={(e) => onChange({ caption: e.target.value })}
        placeholder="Açıklama — videonun altında görünür"
        size="md"
      />
      <BadgesEditor
        badges={block.badges ?? []}
        onChange={(badges) => onChange({ badges })}
      />
    </div>
  );
}
