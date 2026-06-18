"use client";

import { useState } from "react";
import { ProjectData, Block, Section, BadgeItem, BadgePosition, PageItem } from "@/types/project";
import { Segmented } from "@/components/Segmented";
import { ZoomableImage } from "@/components/ZoomableImage";
import { ZoomableFigma } from "@/components/ZoomableFigma";

// ── Badge icon components (matching page.tsx style) ───────────────────────────

function BIcon({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-center w-9 h-9 rounded-full border border-[var(--border)] bg-[var(--bg-1)]/70 backdrop-blur-sm text-[var(--text-subtitle)] ${onClick ? "cursor-pointer hover:text-[var(--text-title)] transition-colors duration-150" : ""}`}
    >
      {children}
    </div>
  );
}

function IconLink() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M7 9C7.33 9.39 7.74 9.71 8.21 9.93 8.68 10.14 9.19 10.25 9.71 10.25c.52 0 1.03-.11 1.5-.32.47-.22.88-.54 1.21-.93L13.92 7.5C14.56 6.83 14.91 5.94 14.9 5.02 14.89 4.1 14.52 3.22 13.87 2.57 13.22 1.92 12.34 1.55 11.42 1.54 10.5 1.53 9.61 1.88 8.94 2.52L7.97 3.49" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M9 7C8.67 6.61 8.26 6.29 7.79 6.07 7.32 5.86 6.81 5.75 6.29 5.75c-.52 0-1.03.11-1.5.32-.47.22-.88.54-1.21.93L2.08 8.5C1.44 9.17 1.09 10.06 1.1 10.98c.01.92.38 1.8 1.03 2.45.65.65 1.53 1.02 2.45 1.03.92.01 1.81-.34 2.48-.98L8.03 12.51" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}

function IconPlay() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M4.5 3L13.5 8L4.5 13V3Z" fill="currentColor" stroke="currentColor" strokeWidth="0.5"/>
    </svg>
  );
}

function IconExternal() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M9 3H13V7M13 3L7 9M6 4H4C3.45 4 3 4.45 3 5V12C3 12.55 3.45 13 4 13H11C11.55 13 12 12.55 12 12V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function IconGear() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M8 2v1.2M8 12.8V14M2 8h1.2M12.8 8H14M3.52 3.52l.85.85M11.63 11.63l.85.85M3.52 12.48l.85-.85M11.63 4.37l.85-.85" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

// ── Position mapping ──────────────────────────────────────────────────────────

const positionClass: Record<BadgePosition, string> = {
  "top-right":    "absolute top-[14px] right-[14px]",
  "top-left":     "absolute top-[14px] left-[14px]",
  "bottom-right": "absolute bottom-[11px] right-[11px]",
  "bottom-left":  "absolute bottom-[11px] left-[11px]",
};

// ── Badge renderer ────────────────────────────────────────────────────────────

function BadgeRenderer({
  badges,
  activeTab,
  onTabChange,
}: {
  badges: BadgeItem[];
  activeTab: string;
  onTabChange: (label: string) => void;
}) {
  // Group badges by position
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
          <div key={pos} className={`${positionClass[pos]} flex items-center gap-2`}>
            {items.map((badge) => {
              if (badge.icon === "segmented") {
                const t1 = badge.tab1Label ?? "Project";
                const t2 = badge.tab2Label ?? "Code";
                return (
                  <Segmented
                    key={badge.id}
                    options={[t1, t2]}
                    value={activeTab || t1}
                    onChange={onTabChange}
                  />
                );
              }
              return (
                <BIcon key={badge.id}>
                  {badge.icon === "link"     && <IconLink />}
                  {badge.icon === "search"   && <IconSearch />}
                  {badge.icon === "play"     && <IconPlay />}
                  {badge.icon === "external" && <IconExternal />}
                  {badge.icon === "gear"     && <IconGear />}
                </BIcon>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

// ── Block renderers ───────────────────────────────────────────────────────────

/** Heading block — same style as the h2 SectionTitle from page.tsx */
function PreviewHeading({ block }: { block: Block }) {
  return (
    <div className="flex flex-col w-full">
      {block.content ? (
        <h2 className="w-full text-base font-medium leading-5 text-[var(--text-title)]">
          {block.content}
        </h2>
      ) : (
        <h2 className="w-full text-base font-medium leading-5 text-[var(--text-subtitle)] opacity-30 italic select-none">
          Başlık…
        </h2>
      )}
      {block.subheading && (
        <p className="w-full text-base font-normal leading-6 text-[var(--text-subtitle)]">
          {block.subheading}
        </p>
      )}
    </div>
  );
}

/** Subheading block — same style as subtitle below SectionTitle from page.tsx */
function PreviewSubheading({ block }: { block: Block }) {
  return block.content ? (
    <p className="w-full text-base font-normal leading-6 text-[var(--text-subtitle)]">
      {block.content}
    </p>
  ) : (
    <p className="w-full text-base font-normal leading-6 text-[var(--text-subtitle)] opacity-30 italic select-none">
      Alt başlık…
    </p>
  );
}

/** Text block — no badge support, just typography */
function PreviewText({ block }: { block: Block }) {
  if (!block.content) {
    return (
      <p className="text-base font-light leading-7 text-[var(--text-subtitle)] italic opacity-30 select-none">
        Metin içeriği burada görünecek…
      </p>
    );
  }
  return (
    <p className="text-base font-light leading-7 text-[var(--text-p)] whitespace-pre-wrap">
      {block.content}
    </p>
  );
}

function PreviewImage({ block }: { block: Block }) {
  const [activeTab, setActiveTab] = useState<string>("");

  const ratio = block.aspectRatio ?? "16/9";
  const aspectMap: Record<string, string> = {
    "16/9": "940/518",
    "4/3":  "940/705",
    "1/1":  "940/940",
  };
  const aspectValue = aspectMap[ratio] ?? "940/518";

  const segBadge = block.badges?.find((b) => b.icon === "segmented");
  const tab1Label = segBadge?.tab1Label ?? "Project";
  const tab2 = segBadge?.tab2;
  const isTab2 = segBadge && activeTab === (segBadge.tab2Label ?? "Code");

  function handleTabChange(label: string) {
    setActiveTab(label);
  }

  return (
    <div className="flex flex-col gap-6 items-center pt-12 pb-9 w-full">
      <div
        className="relative w-full rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] overflow-hidden"
        style={{ aspectRatio: aspectValue }}
      >
        {/* Tab 1 or Tab 2 content */}
        {!isTab2 ? (
          block.src ? (
            <ZoomableImage
              src={block.src}
              alt={block.alt ?? ""}
              className="w-full h-full object-cover"
              badges={block.badges}
              activeTab={activeTab}
              onTabChange={handleTabChange}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[var(--text-subtitle)] text-sm font-light select-none opacity-40">
              Görsel
            </div>
          )
        ) : (
          tab2 ? <SecondTabContent tab2={tab2} /> : null
        )}

        {/* Badges overlay */}
        {block.badges?.length ? (
          <BadgeRenderer
            badges={block.badges}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        ) : null}
      </div>
      {block.caption && (
        <p className="text-sm font-light leading-5 text-[var(--text-subtitle)] text-center w-full">
          {block.caption}
        </p>
      )}
    </div>
  );
}

function PreviewVideo({ block }: { block: Block }) {
  const [activeTab, setActiveTab] = useState<string>("");

  const segBadge = block.badges?.find((b) => b.icon === "segmented");
  const isTab2 = segBadge && activeTab === (segBadge.tab2Label ?? "Code");

  const embedUrl = block.src ? getEmbedUrl(block.src) : null;
  const isRaw = block.src?.endsWith(".mp4") || block.src?.endsWith(".webm");

  return (
    <div className="flex flex-col gap-6 items-center pt-12 pb-9 w-full">
      <div className="relative w-full rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] overflow-hidden aspect-video">
        {!isTab2 ? (
          embedUrl ? (
            isRaw ? (
              <video src={embedUrl} controls className="w-full h-full object-cover" />
            ) : (
              <iframe src={embedUrl} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={block.caption ?? "Video"} />
            )
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[var(--text-subtitle)] text-sm font-light select-none opacity-40">Video</div>
          )
        ) : (
          segBadge?.tab2 ? <SecondTabContent tab2={segBadge.tab2} /> : null
        )}

        {block.badges?.length ? (
          <BadgeRenderer badges={block.badges} activeTab={activeTab} onTabChange={setActiveTab} />
        ) : null}
      </div>
      {block.caption && (
        <p className="text-sm font-light leading-5 text-[var(--text-subtitle)] text-center w-full">{block.caption}</p>
      )}
    </div>
  );
}

function PreviewCode({ block }: { block: Block }) {
  const [activeTab, setActiveTab] = useState<string>("");

  const segBadge = block.badges?.find((b) => b.icon === "segmented");
  const tab1Label = segBadge?.tab1Label ?? "Project";
  const tab2Label = segBadge?.tab2Label ?? "Code";
  const isTab2 = segBadge && activeTab === tab2Label;

  // If no segmented badge, use built-in segmented for code blocks
  const [builtInTab, setBuiltInTab] = useState("Code");
  const usedTab = segBadge ? (isTab2 ? "tab2" : "tab1") : builtInTab;

  const hasCode = Boolean(block.content?.trim());
  const hasPreview = Boolean(block.codePreview?.trim());

  return (
    <div className="flex flex-col gap-6 items-center pt-12 pb-9 w-full">
      <div className="relative w-full rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] overflow-hidden min-h-[200px]">

        {/* Built-in segmented (when no segmented badge) */}
        {!segBadge && (
          <div className="absolute top-[14px] right-[14px] z-10">
            <Segmented
              options={["Preview", "Code"]}
              defaultValue="Code"
              onChange={setBuiltInTab}
            />
          </div>
        )}

        {/* Content area */}
        {usedTab === "Code" || usedTab === "tab1" ? (
          <div className="bg-[var(--bg-2)]">
            <div className="flex items-center gap-1.5 px-4 pt-[52px] pb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--border-hover)]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--border-hover)]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--border-hover)]" />
              <span className="ml-2 text-xs text-[var(--text-subtitle)] font-mono select-none">{block.language ?? "code"}</span>
            </div>
            <pre className="px-4 pb-6 font-mono text-xs leading-6 text-[var(--text-p)] overflow-x-auto whitespace-pre">
              {hasCode ? block.content : <span className="opacity-30 italic">{"// kod girilmedi"}</span>}
            </pre>
          </div>
        ) : usedTab === "Preview" ? (
          <div className="bg-[var(--bg-3)] pt-[52px]">
            {hasPreview ? (
              <div className="px-4 pb-6" dangerouslySetInnerHTML={{ __html: block.codePreview ?? "" }} />
            ) : (
              <div className="flex items-center justify-center h-24 text-sm text-[var(--text-subtitle)] opacity-30 italic font-light select-none">
                HTML önizlemesi girilmedi
              </div>
            )}
          </div>
        ) : usedTab === "tab2" && segBadge?.tab2 ? (
          <div className="pt-[52px] px-4 pb-6">
            <SecondTabContent tab2={segBadge.tab2} />
          </div>
        ) : null}

        {/* Badges overlay */}
        {block.badges?.length ? (
          <BadgeRenderer badges={block.badges} activeTab={activeTab} onTabChange={setActiveTab} />
        ) : null}
      </div>
      {block.caption && (
        <p className="text-sm font-light leading-5 text-[var(--text-subtitle)] text-center w-full">{block.caption}</p>
      )}
    </div>
  );
}

/** Renders the second tab's content based on its type */
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
      <pre className="font-mono text-xs leading-6 text-[var(--text-p)] whitespace-pre overflow-x-auto">
        {tab2.content?.trim() ? tab2.content : <span className="opacity-30 italic">{"// kod girilmedi"}</span>}
      </pre>
    );
  }
  if (tab2.type === "text") {
    return (
      <p className="text-base font-light leading-7 text-[var(--text-p)] whitespace-pre-wrap">
        {tab2.content?.trim() || <span className="opacity-30 italic">Metin girilmedi</span>}
      </p>
    );
  }
  return null;
}

// PreviewFigma removed in favor of ZoomableFigma

function PreviewDivider() {
  return <div className="w-full h-px bg-[var(--border)] my-2" />;
}

// ── Language helpers ─────────────────────────────────────────────────────────

/** Returns a copy of the block with EN fields promoted to the default slots when lang="en" */
function resolveBlock(block: Block, lang: "tr" | "en"): Block {
  if (lang === "tr") return block;
  return {
    ...block,
    content:    block.contentEn    ?? block.content,
    subheading: block.subheadingEn ?? block.subheading,
    alt:        block.altEn        ?? block.alt,
    caption:    block.captionEn    ?? block.caption,
  };
}

function PreviewBlock({ block, lang }: { block: Block; lang: "tr" | "en" }) {
  const b = resolveBlock(block, lang);
  switch (b.type) {
    case "heading":    return <PreviewHeading    block={b} />;
    case "subheading": return <PreviewSubheading block={b} />;
    case "text":    return <PreviewText    block={b} />;
    case "image":   return <PreviewImage   block={b} />;
    case "video":   return <PreviewVideo   block={b} />;
    case "code":    return <PreviewCode    block={b} />;
    case "figma":   return <ZoomableFigma    src={b.src ?? ""} figmaWorkspace={b.figmaWorkspace} figmaCover={b.figmaCover} figmaWorkspaceCover={b.figmaWorkspaceCover} caption={b.caption} lang={lang} />;
    default:        return null;
  }
}

// ── Section renderer ──────────────────────────────────────────────────────────

function PreviewSection({ section, lang }: { section: Section; lang: "tr" | "en" }) {
  return (
    <section className="flex flex-col gap-4 items-start w-full pt-10">
      {/* Blocks — heading/subheading blocks define the visual hierarchy */}
      {section.blocks.map((block) => (
        <div key={block.id} className="w-full">
          <PreviewBlock block={block} lang={lang} />
        </div>
      ))}

      {section.blocks.length === 0 && (
        <p className="text-sm font-light leading-6 text-[var(--text-subtitle)] opacity-30 italic select-none">
          Henüz blok yok.
        </p>
      )}
    </section>
  );
}

// ── Root preview ──────────────────────────────────────────────────────────────

export function ProjectPreview({ project, lang = "tr" }: { project: ProjectData; lang?: "tr" | "en" }) {
  const displayTitle = lang === "en" ? (project.titleEn || project.title) : project.title;
  const displayDesc = lang === "en" ? project.descriptionEn : project.description;

  return (
    <main className="flex flex-col items-center w-full max-w-[720px] mx-auto px-6 py-10">
      {/* Overview header */}
      <section className="flex flex-col items-start w-full">
        <div className="flex flex-col items-start w-full pt-[10px]">
          {displayTitle ? (
            <h1 className="w-full text-base font-medium leading-5 text-[var(--text-title)]">
              {displayTitle}
            </h1>
          ) : (
            <h1 className="w-full text-base font-medium leading-5 text-[var(--text-subtitle)] opacity-30 italic select-none">
              {lang === "en" ? "Project Title" : "Proje Başlığı"}
            </h1>
          )}
          <p className="w-full text-base font-normal leading-6 text-[var(--text-subtitle)] mt-0">
            {[project.category, project.year].filter(Boolean).join(" · ") || (
              <span className="opacity-30 italic">Kategori · Yıl</span>
            )}
          </p>

          {/* Description (Açıklama) */}
          {displayDesc ? (
            <p className="w-full text-base font-light leading-7 text-[var(--text-p)] mt-6 whitespace-pre-wrap">
              {displayDesc}
            </p>
          ) : (
            <p className="w-full text-base font-light leading-7 text-[var(--text-subtitle)] mt-6 italic opacity-30 select-none">
              {lang === "en" ? "Project description goes here…" : "Proje açıklaması burada görünecek…"}
            </p>
          )}

          {/* Cover Image (Resim) */}
          {project.coverImage ? (
            <div
              className="relative w-full rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] overflow-hidden mt-12 mb-6"
              style={{ aspectRatio: "940/518" }}
            >
              <ZoomableImage
                src={project.coverImage}
                alt={displayTitle || project.slug}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div
              className="relative w-full rounded-[32px] border border-dashed border-[var(--border)] bg-[var(--bg-2)] overflow-hidden mt-12 mb-6 flex items-center justify-center text-[var(--text-subtitle)] text-sm font-light select-none opacity-40"
              style={{ aspectRatio: "940/518" }}
            >
              {lang === "en" ? "Cover Image" : "Kapak Resmi"}
            </div>
          )}
        </div>
      </section>

      {/* Flat item list: sections and dividers in order */}
      {project.items.map((item: PageItem) =>
        item.kind === "divider" ? (
          <div key={item.id} className="w-full">
            <PreviewDivider />
          </div>
        ) : (
          <div key={item.id} className="w-full">
            <PreviewSection section={item} lang={lang} />
          </div>
        )
      )}

      {project.items.length === 0 && (
        <div className="mt-16 text-sm text-[var(--text-subtitle)] opacity-30 italic select-none">
          Sol panelden bölüm ekleyin.
        </div>
      )}
    </main>
  );
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function getEmbedUrl(src: string): string | null {
  const ytMatch = src.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = src.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  if (src.endsWith(".mp4") || src.endsWith(".webm")) return src;
  return null;
}
