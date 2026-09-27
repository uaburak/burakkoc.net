"use client";

import { createContext, useContext, useState, type CSSProperties, type ReactNode } from "react";
import { BadgeItem, BadgePosition, Block, ListStyle } from "@/types/project";
import { Segmented } from "@/components/Segmented";
import { IconButton } from "@/components/Button";
import TextScrollingEffect from "@/components/TextScrollingEffect";
import ScrollReveal from "@/components/ScrollReveal";
import { ZoomableImage } from "@/components/ZoomableImage";
import { ZoomableFigma } from "@/components/ZoomableFigma";
import { ZoomableIframe } from "@/components/ZoomableIframe";
import { CodeHighlight } from "@/components/CodeHighlight";
import { ComponentRenderer } from "@/components/demos/ComponentRegistry";
import { cn } from "@/lib/utils";
import { CaseStudyBlock } from "./CaseStudyBlocks";
import { EditableText } from "./Editable";
import { SortableGroup, SortableItem } from "./Sortable";
import type { BlockEditApi, Lang } from "./editing";

/**
 * Every project block, rendered for three audiences:
 * - public page      → `animate` (scroll reveals), no `edit`
 * - live editor      → `edit` API, no animation, placeholders for empty fields
 *
 * The public markup is the one that used to live in ProjectDetailClient.
 */

interface CoreProps {
  block: Block;
  animate: boolean;
  edit?: BlockEditApi;
}

function TextReveal({ animate, children }: { animate: boolean; children: ReactNode }) {
  return animate ? <TextScrollingEffect>{children}</TextScrollingEffect> : <>{children}</>;
}

/**
 * Set by a grid cell whose height is Fill / Fixed (see sizeProps): images and
 * videos stretch to that height (from md up) instead of keeping their aspect ratio.
 */
export const FillHeightContext = createContext(false);

function Reveal({ animate, className, children }: { animate: boolean; className?: string; children: ReactNode }) {
  return animate ? <ScrollReveal className={className}>{children}</ScrollReveal> : <>{children}</>;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function LinkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M8.5 11.5L11.5 8.5M7 13C5.34 13 4 11.66 4 10C4 8.34 5.34 7 7 7H9M11 13H13C14.66 13 16 11.66 16 10C16 8.34 14.66 7 13 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="9" cy="9" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 13L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 3v1.5M10 15.5V17M3 10h1.5M15.5 10H17M4.93 4.93l1.06 1.06M14.01 14.01l1.06 1.06M4.93 15.07l1.06-1.06M14.01 5.99l1.06-1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M6.5 4.5L15.5 10L6.5 15.5V4.5Z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M11 4H16V9M16 4L10 10M8 5H5C4.45 5 4 5.45 4 6V15C4 15.55 4.45 16 5 16H14C14.55 16 15 15.55 15 15V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Badges ────────────────────────────────────────────────────────────────────

const positionClass: Record<BadgePosition, string> = {
  "top-right":    "absolute top-[14px] right-[14px]",
  "top-left":     "absolute top-[14px] left-[14px]",
  "bottom-right": "absolute bottom-[11px] right-[11px]",
  "bottom-left":  "absolute bottom-[11px] left-[11px]",
};

const BADGE_LABELS: Record<string, string> = {
  link: "Link",
  search: "Search",
  play: "Play",
  external: "External Link",
  gear: "Settings",
};

function BadgeIcon({ icon }: { icon: BadgeItem["icon"] }) {
  switch (icon) {
    case "link": return <LinkIcon />;
    case "search": return <SearchIcon />;
    case "play": return <PlayIcon />;
    case "external": return <ExternalIcon />;
    case "gear": return <GearIcon />;
    default: return null;
  }
}

function BadgeRenderer({ badges, activeTab, onTabChange }: {
  badges: BadgeItem[];
  activeTab: string;
  onTabChange: (label: string) => void;
}) {
  const grouped = badges.reduce<Record<BadgePosition, BadgeItem[]>>(
    (acc, b) => {
      acc[b.position] = [...(acc[b.position] ?? []), b];
      return acc;
    },
    { "top-right": [], "top-left": [], "bottom-right": [], "bottom-left": [] }
  );

  return (
    <>
      {(Object.entries(grouped) as [BadgePosition, BadgeItem[]][]).map(([pos, items]) => {
        if (!items.length) return null;
        return (
          <div key={pos} className={`${positionClass[pos]} flex items-center gap-2 z-10`}>
            {items.map((badge) => {
              if (badge.icon === "segmented") {
                const t1 = badge.tab1Label ?? "Project";
                const t2 = badge.tab2Label ?? "Code";
                return <Segmented key={badge.id} options={[t1, t2]} value={activeTab || t1} onChange={onTabChange} />;
              }
              const ariaLabel = BADGE_LABELS[badge.icon] || "Icon Badge";
              if (badge.href) {
                return (
                  <a
                    key={badge.id}
                    href={badge.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={ariaLabel}
                    className="flex items-center justify-center w-10 h-10 rounded-full border border-[var(--border)] bg-[var(--bg-2)] text-[var(--text-title)] transition-all duration-200 cursor-pointer hover:bg-[var(--bg-4)] hover:border-[var(--border-hover)] active:scale-95"
                  >
                    <BadgeIcon icon={badge.icon} />
                  </a>
                );
              }
              return (
                <IconButton key={badge.id} aria-label={ariaLabel} size="md">
                  <BadgeIcon icon={badge.icon} />
                </IconButton>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

export function getEmbedUrl(src: string): string | null {
  const ytMatch = src.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = src.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  if (src.endsWith(".mp4") || src.endsWith(".webm")) return src;
  return null;
}

function SecondTabContent({ tab2 }: { tab2: NonNullable<BadgeItem["tab2"]> }) {
  if (tab2.type === "image") {
    return tab2.src ? (
      <ZoomableImage src={tab2.src} alt="" className="w-full h-full object-cover" />
    ) : (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--text-subtitle)] opacity-40 select-none">Görsel URL girilmedi</div>
    );
  }
  if (tab2.type === "video") {
    const url = tab2.src ? getEmbedUrl(tab2.src) : null;
    return url ? (
      <iframe src={url} className="absolute inset-0 w-full h-full" allowFullScreen title="Video" />
    ) : (
      <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--text-subtitle)] opacity-40 select-none">Video URL girilmedi</div>
    );
  }
  if (tab2.type === "code") {
    return (
      <div className="w-full h-full bg-[var(--bg-2)]">
        <CodeHighlight code={tab2.content?.trim() || "// kod girilmedi"} language={tab2.language || "javascript"} />
      </div>
    );
  }
  if (tab2.type === "text") {
    return (
      <div className="w-full h-full overflow-auto p-5 sm:p-6 bg-[var(--bg-2)]">
        <p className="text-base font-light leading-7 text-[var(--text-p)] whitespace-pre-wrap">
          {tab2.content?.trim() || "Metin girilmedi"}
        </p>
      </div>
    );
  }
  return null;
}

/** Caption under media blocks; editable in the live editor. */
function MediaCaption({ block, edit }: { block: Block; edit?: BlockEditApi }) {
  return (
    <EditableText
      as="p"
      className="text-sm font-light leading-5 text-[var(--text-subtitle)] text-center w-full"
      value={block.caption}
      onChange={edit && ((v) => edit.setText("caption", v))}
      placeholder="Açıklama ekle (opsiyonel)"
    />
  );
}

// ── Text blocks ───────────────────────────────────────────────────────────────

function HeadingBlock({ block, animate, edit }: CoreProps) {
  if (!block.content && !edit) return null;
  return (
    <div className="flex flex-col w-full">
      <TextReveal animate={animate}>
        <EditableText
          as="h2"
          className="w-full text-base font-medium leading-5 text-[var(--text-title)]"
          value={block.content}
          onChange={edit && ((v) => edit.setText("content", v))}
          placeholder="Başlık"
        />
      </TextReveal>
      {(block.subheading || edit) && (
        <TextReveal animate={animate}>
          <EditableText
            as="p"
            className="w-full text-base font-normal leading-6 text-[var(--text-subtitle)]"
            value={block.subheading}
            onChange={edit && ((v) => edit.setText("subheading", v))}
            placeholder="Alt başlık (opsiyonel)"
          />
        </TextReveal>
      )}
    </div>
  );
}

function SubheadingBlock({ block, animate, edit }: CoreProps) {
  if (!block.content && !edit) return null;
  return (
    <TextReveal animate={animate}>
      <EditableText
        as="p"
        className="w-full text-base font-normal leading-6 text-[var(--text-subtitle)]"
        value={block.content}
        onChange={edit && ((v) => edit.setText("content", v))}
        placeholder="Alt başlık"
      />
    </TextReveal>
  );
}

function TextBlock({ block, animate, edit }: CoreProps) {
  if (!block.content && !edit) return null;
  return (
    <TextReveal animate={animate}>
      <EditableText
        as="p"
        rich
        multiline
        className="text-base font-light leading-7 text-[var(--text-p)] whitespace-pre-wrap"
        value={block.content}
        onChange={edit && ((v) => edit.setText("content", v))}
        placeholder="Paragraf metni… **kalın** ve [bağlantı](https://…) kullanabilirsin"
      />
    </TextReveal>
  );
}

// ── Media blocks ──────────────────────────────────────────────────────────────

const IMAGE_ASPECT: Record<string, string> = {
  "16/9": "940/518",
  "4/3":  "940/705",
  "1/1":  "940/940",
};

function ImageBlock({ block, animate, edit }: CoreProps) {
  const [activeTab, setActiveTab] = useState<string>("");
  const aspectValue = IMAGE_ASPECT[block.aspectRatio ?? "16/9"] ?? "940/518";
  const segBadge = block.badges?.find((b) => b.icon === "segmented");
  const tab2 = segBadge?.tab2;
  const isTab2 = segBadge && activeTab === (segBadge.tab2Label ?? "Code");
  const fill = useContext(FillHeightContext);

  return (
    <Reveal animate={animate} className={fill ? "md:flex md:flex-col" : undefined}>
      <div className={cn("flex flex-col gap-6 items-center pt-12 pb-9 w-full", fill && "md:flex-1 md:min-h-0")}>
        <div
          className={cn(
            "relative w-full rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] overflow-hidden aspect-(--aspect)",
            // In a Fill / Fixed height cell: as tall as the cell allows.
            fill && "md:aspect-auto md:flex-1 md:min-h-0"
          )}
          style={{ "--aspect": aspectValue } as CSSProperties}
        >
          {!isTab2 ? (
            block.src ? (
              edit ? (
                // Live editor: a click selects the block instead of opening the lightbox
                // eslint-disable-next-line @next/next/no-img-element
                <img src={block.src} alt={block.alt ?? ""} draggable={false} className="w-full h-full object-cover" />
              ) : (
                <ZoomableImage
                  src={block.src}
                  alt={block.alt ?? ""}
                  className="w-full h-full object-cover"
                  badges={block.badges}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                />
              )
            ) : (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-[var(--text-subtitle)] text-sm font-light select-none opacity-40">
                {edit ? (block.alt || "Görsel ekle — Düzenle panelinden") : "Görsel bulunamadı"}
              </div>
            )
          ) : tab2 ? (
            <SecondTabContent tab2={tab2} />
          ) : null}

          {block.badges?.length ? (
            <BadgeRenderer badges={block.badges} activeTab={activeTab} onTabChange={setActiveTab} />
          ) : null}
        </div>
        <MediaCaption block={block} edit={edit} />
      </div>
    </Reveal>
  );
}

function VideoBlock({ block, animate, edit }: CoreProps) {
  const [activeTab, setActiveTab] = useState<string>("");
  const segBadge = block.badges?.find((b) => b.icon === "segmented");
  const isTab2 = segBadge && activeTab === (segBadge.tab2Label ?? "Code");
  const embedUrl = block.src ? getEmbedUrl(block.src) : null;
  const isRaw = block.src?.endsWith(".mp4") || block.src?.endsWith(".webm");
  const fill = useContext(FillHeightContext);

  return (
    <Reveal animate={animate} className={fill ? "md:flex md:flex-col" : undefined}>
      <div className={cn("flex flex-col gap-6 items-center pt-12 pb-9 w-full", fill && "md:flex-1 md:min-h-0")}>
        <div
          className={cn(
            "relative w-full rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] overflow-hidden aspect-video",
            fill && "md:aspect-auto md:flex-1 md:min-h-0"
          )}
        >
          {!isTab2 ? (
            embedUrl ? (
              isRaw ? (
                block.videoLoop ? (
                  <video src={embedUrl} autoPlay muted loop playsInline className="w-full h-full object-cover" />
                ) : (
                  <video src={embedUrl} controls className={cn("w-full h-full object-cover", edit && "pointer-events-none")} />
                )
              ) : (
                <iframe
                  src={embedUrl}
                  className={cn("w-full h-full", edit && "pointer-events-none")}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={block.caption ?? "Video"}
                />
              )
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[var(--text-subtitle)] text-sm font-light select-none opacity-40">
                {edit ? "Video bağlantısı ekle — Düzenle panelinden" : "Video bulunamadı"}
              </div>
            )
          ) : segBadge?.tab2 ? (
            <SecondTabContent tab2={segBadge.tab2} />
          ) : null}

          {block.badges?.length ? (
            <BadgeRenderer badges={block.badges} activeTab={activeTab} onTabChange={setActiveTab} />
          ) : null}
        </div>
        <MediaCaption block={block} edit={edit} />
      </div>
    </Reveal>
  );
}

function CodeBlock({ block, animate, edit }: CoreProps) {
  const [activeTab, setActiveTab] = useState<string>("");
  const segBadge = block.badges?.find((b) => b.icon === "segmented");
  const tab2Label = segBadge?.tab2Label ?? "Code";
  const isTab2 = segBadge && activeTab === tab2Label;
  const [builtInTab, setBuiltInTab] = useState("Code");
  const usedTab = segBadge ? (isTab2 ? "tab2" : "tab1") : builtInTab;
  const hasCode = Boolean(block.content?.trim());
  const hasPreview = Boolean(block.codePreview?.trim() || block.previewComponent);

  return (
    <Reveal animate={animate}>
      <div className="flex flex-col gap-6 items-center pt-12 pb-9 w-full">
        <div className="relative w-full rounded-[32px] border border-[var(--border)] bg-[var(--bg-code)] overflow-hidden">
          {!segBadge && hasPreview && (
            <div className="absolute top-[14px] right-[14px] z-10">
              <Segmented options={["Preview", "Code"]} defaultValue="Code" onChange={setBuiltInTab} />
            </div>
          )}

          {usedTab === "Code" || usedTab === "tab1" ? (
            <div className="bg-transparent">
              {hasCode ? (
                <CodeHighlight code={block.content ?? ""} language={block.language ?? "javascript"} />
              ) : (
                <div className="p-5 sm:p-6 opacity-30 italic font-mono text-xs text-[var(--text-subtitle)]">{"// kod girilmedi"}</div>
              )}
            </div>
          ) : usedTab === "Preview" ? (
            <div className="bg-[var(--bg-3)] p-5 sm:p-6 min-h-[120px] flex items-center justify-center">
              {block.previewComponent ? (
                <ComponentRenderer componentKey={block.previewComponent} />
              ) : hasPreview ? (
                <div className="w-full" dangerouslySetInnerHTML={{ __html: block.codePreview ?? "" }} />
              ) : (
                <div className="flex items-center justify-center h-24 text-sm text-[var(--text-subtitle)] opacity-30 italic font-light select-none">
                  Önizleme girilmedi
                </div>
              )}
            </div>
          ) : usedTab === "tab2" && segBadge?.tab2 ? (
            <div className="w-full h-full min-h-[180px]">
              <SecondTabContent tab2={segBadge.tab2} />
            </div>
          ) : null}

          {block.badges?.length ? (
            <BadgeRenderer badges={block.badges} activeTab={activeTab} onTabChange={setActiveTab} />
          ) : null}
        </div>
        <MediaCaption block={block} edit={edit} />
      </div>
    </Reveal>
  );
}

// ── List ──────────────────────────────────────────────────────────────────────

function ListMarker({ style, index, checked, onToggle }: {
  style: ListStyle;
  index: number;
  checked: boolean;
  onToggle?: () => void;
}) {
  if (style === "bullet") return <span className="shrink-0 mt-[9px] w-1.5 h-1.5 rounded-full bg-[var(--text-title)]" />;
  if (style === "numbered") {
    return <span className="shrink-0 mt-[1px] min-w-[20px] text-sm font-medium text-[var(--text-subtitle)] tabular-nums">{index + 1}.</span>;
  }
  if (style === "dash") return <span className="shrink-0 mt-[1px] text-sm font-medium text-[var(--text-subtitle)]">—</span>;
  const box = (
    <span
      className="flex items-center justify-center w-[18px] h-[18px] rounded-[5px] border transition-colors duration-150"
      style={checked ? { background: "var(--project-accent, var(--text-title))", borderColor: "var(--project-accent, var(--text-title))" } : { borderColor: "var(--border-hover)", background: "var(--bg-1)" }}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5.5L4 7.5L8 3" stroke="var(--bg-1)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
  return onToggle ? (
    <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label="İşaretle" className="shrink-0 mt-[3px] cursor-pointer">
      {box}
    </button>
  ) : (
    <span className="shrink-0 mt-[3px]">{box}</span>
  );
}

const LIST_ITEM_CLASS = "flex items-start gap-2.5 px-4 py-2.5 rounded-[22px] bg-[var(--bg-4)] text-base font-light leading-6 text-[var(--text-p)] transition-colors";

function ListBlock({ block, animate, edit }: CoreProps) {
  const items = block.listItems ?? [];
  const style: ListStyle = block.listStyle ?? "bullet";
  const [focusId, setFocusId] = useState<string | null>(null);

  if (!edit) {
    if (items.length === 0) return null;
    return (
      <div className="flex flex-col gap-2.5 w-full">
        {items.map((item, idx) => {
          const isChecked = style === "check" && Boolean(item.checked);
          const row = (
            <div className={LIST_ITEM_CLASS}>
              <ListMarker style={style} index={idx} checked={isChecked} />
              <span className="flex-1 min-w-0" style={isChecked ? { textDecoration: "line-through", opacity: 0.5 } : {}}>
                {item.text}
              </span>
            </div>
          );
          return animate ? (
            <ScrollReveal key={item.id} className="w-full">{row}</ScrollReveal>
          ) : (
            <div key={item.id} className="w-full">{row}</div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 w-full items-start">
      <SortableGroup ids={items.map((i) => i.id)} onMove={edit.moveListItem}>
        <div className="flex flex-col gap-2.5 w-full">
          {items.map((item, idx) => {
            const isChecked = style === "check" && Boolean(item.checked);
            return (
              <SortableItem key={item.id} id={item.id} className={LIST_ITEM_CLASS} onRemove={() => edit.removeListItem(item.id)}>
                <ListMarker style={style} index={idx} checked={isChecked} onToggle={style === "check" ? () => edit.toggleListItem(item.id) : undefined} />
                <EditableText
                  className={cn("flex-1 min-w-0", isChecked && "line-through opacity-50")}
                  value={item.text}
                  onChange={(v) => edit.setListItemText(item.id, v)}
                  placeholder="Liste öğesi"
                  autoEdit={focusId === item.id}
                  onEnter={() => setFocusId(edit.addListItem(item.id))}
                  onBackspaceEmpty={items.length > 1 ? () => edit.removeListItem(item.id) : undefined}
                />
              </SortableItem>
            );
          })}
        </div>
      </SortableGroup>
      {items.length === 0 && (
        // An empty list would be invisible on the canvas: offer the first item.
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setFocusId(edit.addListItem()); }}
          className={cn(LIST_ITEM_CLASS, "w-full border border-dashed border-[var(--border-hover)] bg-transparent text-[var(--text-subtitle)] hover:text-[var(--text-title)] cursor-pointer")}
        >
          <ListMarker style={style} index={0} checked={false} />
          <span className="flex-1 min-w-0 text-left">İlk maddeyi ekle</span>
        </button>
      )}
    </div>
  );
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function ProjectBlock({ block, animate = false, edit, lang = "tr" }: {
  block: Block;
  animate?: boolean;
  edit?: BlockEditApi;
  lang?: Lang;
}) {
  switch (block.type) {
    case "heading":    return <HeadingBlock    block={block} animate={animate} edit={edit} />;
    case "subheading": return <SubheadingBlock block={block} animate={animate} edit={edit} />;
    case "text":       return <TextBlock       block={block} animate={animate} edit={edit} />;
    case "image":      return <ImageBlock      block={block} animate={animate} edit={edit} />;
    case "video":      return <VideoBlock      block={block} animate={animate} edit={edit} />;
    case "code":       return <CodeBlock       block={block} animate={animate} edit={edit} />;
    case "list":       return <ListBlock       block={block} animate={animate} edit={edit} />;
    case "figma":
      return (
        <ZoomableFigma src={block.src ?? ""} figmaWorkspace={block.figmaWorkspace} figmaCover={block.figmaCover}
          figmaWorkspaceCover={block.figmaWorkspaceCover} caption={block.caption} lang={lang} animate={animate} />
      );
    case "iframe":
      return (
        <ZoomableIframe src={block.src} iframeTabletUrl={block.iframeTabletUrl} iframeMobileUrl={block.iframeMobileUrl}
          iframeViews={block.iframeViews} iframeCover={block.iframeCover} caption={block.caption} lang={lang} animate={animate} />
      );
    default:
      return <CaseStudyBlock block={block} animate={animate} edit={edit} />;
  }
}

export function ProjectDivider() {
  return <div className="w-full h-px bg-[var(--border)] my-2" />;
}
