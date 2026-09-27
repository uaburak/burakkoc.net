"use client";

import { Block } from "@/types/project";
import { Input } from "@/components/Input";
import { TextBlockEditor }  from "@/components/admin/TextBlockEditor";
import { ImageBlockEditor } from "@/components/admin/ImageBlockEditor";
import { VideoBlockEditor } from "@/components/admin/VideoBlockEditor";
import { CodeBlockEditor }  from "@/components/admin/CodeBlockEditor";
import { FigmaBlockEditor } from "@/components/admin/FigmaBlockEditor";
import { IframeBlockEditor } from "@/components/admin/IframeBlockEditor";
import { ListBlockEditor }  from "@/components/admin/ListBlockEditor";
import { CaseStudyBlockEditor } from "@/components/admin/CaseStudyBlockEditor";
import { isCaseStudyBlock } from "@/components/project/CaseStudyBlocks";

/**
 * A block's settings form — the body of a block row in the form editor and of
 * the settings panel in the live editor.
 *
 * The legacy editors only know `content` / `alt` / `caption`; in English they
 * are shown the EN values and their writes are routed to the `…En` fields.
 */

// ── Heading / Subheading editor ───────────────────────────────────────────────

function HeadingBlockEditor({ block, onChange, lang }: { block: Block; onChange: (u: Partial<Block>) => void; lang: "tr" | "en" }) {
  if (block.type === "subheading") {
    // Legacy support for separate subheading blocks:
    const value = lang === "en" ? (block.contentEn ?? "") : (block.content ?? "");
    const placeholder = lang === "en" ? "Subheading text…" : "Alt başlık metni…";
    return (
      <Input
        type="text"
        bgContext="block"
        value={value}
        onChange={(e) => onChange(lang === "en" ? { contentEn: e.target.value } : { content: e.target.value })}
        placeholder={placeholder}
        size="md"
        className="text-[var(--text-subtitle)]"
      />
    );
  }

  // Combined heading/subheading editor
  const headingVal = lang === "en" ? (block.contentEn ?? "") : (block.content ?? "");
  const subheadingVal = lang === "en" ? (block.subheadingEn ?? "") : (block.subheading ?? "");

  const headingPlaceholder = lang === "en" ? "Heading text…" : "Başlık metni…";
  const subheadingPlaceholder = lang === "en" ? "Subheading text (optional)…" : "Alt başlık metni (isteğe bağlı)…";

  return (
    <div className="flex flex-col gap-2 w-full">
      <Input
        type="text"
        bgContext="block"
        value={headingVal}
        onChange={(e) => onChange(lang === "en" ? { contentEn: e.target.value } : { content: e.target.value })}
        placeholder={headingPlaceholder}
        size="md"
        className="font-medium text-[var(--text-title)]"
      />
      <Input
        type="text"
        bgContext="block"
        value={subheadingVal}
        onChange={(e) => onChange(lang === "en" ? { subheadingEn: e.target.value } : { subheading: e.target.value })}
        placeholder={subheadingPlaceholder}
        size="md"
        className="text-[var(--text-subtitle)] text-sm"
      />
    </div>
  );
}

// ── Block fields ──────────────────────────────────────────────────────────────

export function BlockFields({ block, onChange, lang, projectSlug }: {
  block: Block;
  onChange: (u: Partial<Block>) => void;
  lang: "tr" | "en";
  projectSlug: string;
}) {
  function handleChange(u: Partial<Block>) {
    if (lang === "en") {
      const mapped: Partial<Block> = { ...u };
      if ("content" in u) { mapped.contentEn = u.content; delete mapped.content; }
      if ("alt"     in u) { mapped.altEn     = u.alt;     delete mapped.alt;     }
      if ("caption" in u) { mapped.captionEn = u.caption; delete mapped.caption; }
      onChange(mapped);
    } else {
      onChange(u);
    }
  }

  const viewBlock: Block = lang === "en"
    ? { ...block, content: block.contentEn ?? "", alt: block.altEn ?? "", caption: block.captionEn ?? "" }
    : block;

  return (
    <>
      {(block.type === "heading" || block.type === "subheading") && <HeadingBlockEditor block={block} onChange={onChange} lang={lang} />}
      {block.type === "text"   && <TextBlockEditor   block={viewBlock} onChange={handleChange} />}
      {block.type === "image"  && <ImageBlockEditor  block={viewBlock} onChange={handleChange} projectSlug={projectSlug} />}
      {block.type === "video"  && <VideoBlockEditor  block={viewBlock} onChange={handleChange} />}
      {block.type === "code"   && <CodeBlockEditor   block={viewBlock} onChange={handleChange} />}
      {block.type === "figma"  && <FigmaBlockEditor  block={viewBlock} onChange={handleChange} projectSlug={projectSlug} />}
      {block.type === "iframe" && <IframeBlockEditor block={viewBlock} onChange={handleChange} projectSlug={projectSlug} />}
      {block.type === "list"   && <ListBlockEditor   block={viewBlock} onChange={handleChange} />}
      {isCaseStudyBlock(block.type) && <CaseStudyBlockEditor block={block} onChange={onChange} lang={lang} projectSlug={projectSlug} />}
    </>
  );
}
