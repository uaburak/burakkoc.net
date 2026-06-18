"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowLeftIcon } from "@/components/icons";
import { Segmented } from "@/components/Segmented";
import { TableOfContents, type TocItem } from "@/components/TableOfContents";
import { loadProject, listProjects } from "@/lib/firestore";
import { ProjectData, Block, Section, BadgeItem, BadgePosition, PageItem } from "@/types/project";
import TextScrollingEffect from "@/components/TextScrollingEffect";
import ScrollReveal from "@/components/ScrollReveal";
import { ZoomableImage } from "@/components/ZoomableImage";
import { ZoomableFigma } from "@/components/ZoomableFigma";
import { IconButton } from "@/components/Button";

// ── SVG Icons ──────────────────────────────────────────────────

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
                return (
                  <Segmented
                    key={badge.id}
                    options={[t1, t2]}
                    value={activeTab || t1}
                    onChange={onTabChange}
                  />
                );
              }

              const IconComponent = () => {
                switch (badge.icon) {
                  case "link": return <LinkIcon />;
                  case "search": return <SearchIcon />;
                  case "play": return <PlayIcon />;
                  case "external": return <ExternalIcon />;
                  case "gear": return <GearIcon />;
                  default: return null;
                }
              };

              const labelMap: Record<string, string> = {
                link: "Link",
                search: "Search",
                play: "Play",
                external: "External Link",
                gear: "Settings",
              };

              const ariaLabel = labelMap[badge.icon] || "Icon Badge";

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
                    <IconComponent />
                  </a>
                );
              }

              return (
                <IconButton
                  key={badge.id}
                  aria-label={ariaLabel}
                  size="md"
                >
                  <IconComponent />
                </IconButton>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

// ── Block renderers ───────────────────────────────────────────────────────────

function DetailHeading({ block }: { block: Block }) {
  if (!block.content) return null;
  return (
    <div className="flex flex-col w-full">
      <TextScrollingEffect>
        <h2 className="w-full text-base font-medium leading-5 text-[var(--text-title)]">
          {block.content}
        </h2>
      </TextScrollingEffect>
      {block.subheading && (
        <TextScrollingEffect>
          <p className="w-full text-base font-normal leading-6 text-[var(--text-subtitle)]">
            {block.subheading}
          </p>
        </TextScrollingEffect>
      )}
    </div>
  );
}

function DetailSubheading({ block }: { block: Block }) {
  if (!block.content) return null;
  return (
    <TextScrollingEffect>
      <p className="w-full text-base font-normal leading-6 text-[var(--text-subtitle)]">
        {block.content}
      </p>
    </TextScrollingEffect>
  );
}

function DetailText({ block }: { block: Block }) {
  if (!block.content) return null;
  return (
    <TextScrollingEffect>
      <p className="text-base font-light leading-7 text-[var(--text-p)] whitespace-pre-wrap">
        {block.content}
      </p>
    </TextScrollingEffect>
  );
}

function DetailImage({ block }: { block: Block }) {
  const [activeTab, setActiveTab] = useState<string>("");

  const ratio = block.aspectRatio ?? "16/9";
  const aspectMap: Record<string, string> = {
    "16/9": "940/518",
    "4/3":  "940/705",
    "1/1":  "940/940",
  };
  const aspectValue = aspectMap[ratio] ?? "940/518";

  const segBadge = block.badges?.find((b) => b.icon === "segmented");
  const tab2 = segBadge?.tab2;
  const isTab2 = segBadge && activeTab === (segBadge.tab2Label ?? "Code");

  return (
    <ScrollReveal>
      <div className="flex flex-col gap-6 items-center pt-12 pb-9 w-full">
        <div
          className="relative w-full rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] overflow-hidden"
          style={{ aspectRatio: aspectValue }}
        >
          {!isTab2 ? (
            block.src ? (
              <ZoomableImage
                src={block.src}
                alt={block.alt ?? ""}
                className="w-full h-full object-cover"
                badges={block.badges}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[var(--text-subtitle)] text-sm font-light select-none opacity-40">
                Görsel bulunamadı
              </div>
            )
          ) : (
            tab2 ? <SecondTabContent tab2={tab2} /> : null
          )}

          {block.badges?.length ? (
            <BadgeRenderer
              badges={block.badges}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          ) : null}
        </div>
        {block.caption && (
          <p className="text-sm font-light leading-5 text-[var(--text-subtitle)] text-center w-full">
            {block.caption}
          </p>
        )}
      </div>
    </ScrollReveal>
  );
}

function DetailVideo({ block }: { block: Block }) {
  const [activeTab, setActiveTab] = useState<string>("");

  const segBadge = block.badges?.find((b) => b.icon === "segmented");
  const isTab2 = segBadge && activeTab === (segBadge.tab2Label ?? "Code");

  const embedUrl = block.src ? getEmbedUrl(block.src) : null;
  const isRaw = block.src?.endsWith(".mp4") || block.src?.endsWith(".webm");

  return (
    <ScrollReveal>
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
              <div className="absolute inset-0 flex items-center justify-center text-[var(--text-subtitle)] text-sm font-light select-none opacity-40">Video bulunamadı</div>
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
    </ScrollReveal>
  );
}

function DetailCode({ block }: { block: Block }) {
  const [activeTab, setActiveTab] = useState<string>("");

  const segBadge = block.badges?.find((b) => b.icon === "segmented");
  const tab1Label = segBadge?.tab1Label ?? "Project";
  const tab2Label = segBadge?.tab2Label ?? "Code";
  const isTab2 = segBadge && activeTab === tab2Label;

  const [builtInTab, setBuiltInTab] = useState("Code");
  const usedTab = segBadge ? (isTab2 ? "tab2" : "tab1") : builtInTab;

  const hasCode = Boolean(block.content?.trim());
  const hasPreview = Boolean(block.codePreview?.trim());

  return (
    <ScrollReveal>
      <div className="flex flex-col gap-6 items-center pt-12 pb-9 w-full">
        <div className="relative w-full rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] overflow-hidden min-h-[200px]">
          {!segBadge && (
            <div className="absolute top-[14px] right-[14px] z-10">
              <Segmented
                options={["Preview", "Code"]}
                defaultValue="Code"
                onChange={setBuiltInTab}
              />
            </div>
          )}

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

          {block.badges?.length ? (
            <BadgeRenderer badges={block.badges} activeTab={activeTab} onTabChange={setActiveTab} />
          ) : null}
        </div>
        {block.caption && (
          <p className="text-sm font-light leading-5 text-[var(--text-subtitle)] text-center w-full">{block.caption}</p>
        )}
      </div>
    </ScrollReveal>
  );
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
      <pre className="font-mono text-xs leading-6 text-[var(--text-p)] whitespace-pre overflow-x-auto">
        {tab2.content?.trim() || "// kod girilmedi"}
      </pre>
    );
  }
  if (tab2.type === "text") {
    return (
      <p className="text-base font-light leading-7 text-[var(--text-p)] whitespace-pre-wrap">
        {tab2.content?.trim() || "Metin girilmedi"}
      </p>
    );
  }
  return null;
}

// DetailFigma removed in favor of ZoomableFigma

function DetailDivider() {
  return <div className="w-full h-px bg-[var(--border)] my-2" />;
}

function DetailBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":    return <DetailHeading    block={block} />;
    case "subheading": return <DetailSubheading block={block} />;
    case "text":       return <DetailText       block={block} />;
    case "image":      return <DetailImage      block={block} />;
    case "video":      return <DetailVideo      block={block} />;
    case "code":       return <DetailCode       block={block} />;
    case "figma":      return <ZoomableFigma    src={block.src ?? ""} figmaWorkspace={block.figmaWorkspace} figmaCover={block.figmaCover} figmaWorkspaceCover={block.figmaWorkspaceCover} caption={block.caption} />;
    default:           return null;
  }
}

function DetailSection({ section }: { section: Section }) {
  return (
    <section id={section.id} className="flex flex-col gap-4 items-start w-full pt-10 scroll-mt-24">
      {section.blocks.map((block) => (
        <div key={block.id} className="w-full">
          <DetailBlock block={block} />
        </div>
      ))}
    </section>
  );
}

function getEmbedUrl(src: string): string | null {
  const ytMatch = src.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = src.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  if (src.endsWith(".mp4") || src.endsWith(".webm")) return src;
  return null;
}

// ── Skeleton Loader Component ─────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--bg-1)] animate-pulse relative">
      <div className="fixed top-[160px] left-[calc(50%-468px)] w-[200px] flex-col items-start gap-3 hidden xl:flex">
        <div className="h-8 w-24 rounded-full bg-[var(--bg-3)]" />
        <div className="h-8 w-24 rounded-full bg-[var(--bg-3)]" />
      </div>

      <div className="fixed top-[160px] left-[calc(50%+380px)] w-[180px] hidden xl:block">
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 w-28 rounded bg-[var(--bg-3)]" />
          ))}
        </div>
      </div>

      <main className="flex flex-col items-center w-full max-w-[720px] mx-auto px-5 py-10 xl:px-6 xl:pt-[160px] xl:pb-[60px]">
        <div className="w-full pt-[10px] flex flex-col gap-2.5">
          <div className="h-6 w-48 rounded bg-[var(--bg-3)]" />
          <div className="h-4 w-32 rounded bg-[var(--bg-3)]" />
        </div>
        <div className="mt-10 w-full flex flex-col gap-4">
          <div className="h-4 w-full rounded bg-[var(--bg-3)]" />
          <div className="h-4 w-full rounded bg-[var(--bg-3)]" />
          <div className="h-4 w-2/3 rounded bg-[var(--bg-3)]" />
        </div>
        <div className="mt-12 w-full rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] aspect-[940/518]" />
      </main>
    </div>
  );
}

// ── Main Client Component ─────────────────────────────────────────────────────

interface ProjectDetailClientProps {
  slug: string;
  initialProject?: ProjectData | null;
  initialProjects?: ProjectData[];
}

export function ProjectDetailClient({
  slug,
  initialProject,
  initialProjects,
}: ProjectDetailClientProps) {
  const [project, setProject] = useState<ProjectData | null>(initialProject || null);
  const [projects, setProjects] = useState<ProjectData[]>(initialProjects || []);
  const [loading, setLoading] = useState(!initialProject);

  useEffect(() => {
    if (initialProject) {
      setProject(initialProject);
      if (initialProjects) {
        setProjects(initialProjects);
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    loadProject(slug)
      .then((data) => setProject(data))
      .catch((err) => console.error("Failed to load project details:", err))
      .finally(() => setLoading(false));

    listProjects()
      .then(setProjects)
      .catch((err) => console.error("Failed to list projects:", err));
  }, [slug, initialProject, initialProjects]);

  if (loading) return <DetailSkeleton />;

  if (!project) {
    return (
      <div className="min-h-screen bg-[var(--bg-1)] flex items-center justify-center px-6">
        <div className="text-center flex flex-col items-center gap-4">
          <h1 className="text-base font-medium text-[var(--text-title)]">Project Not Found</h1>
          <p className="text-sm font-light text-[var(--text-subtitle)]">The requested project could not be found or has been removed.</p>
          <Link href="/projects" className="px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--bg-2)] text-sm text-[var(--text-p)] hover:bg-[var(--bg-4)] transition-all duration-200">
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  const tocItems: TocItem[] = [{ id: "overview", label: "Overview" }];
  project.items.forEach((item) => {
    if (item.kind === "section") {
      const headingBlock = item.blocks.find(
        (b) => b.type === "heading" && b.content && b.content.trim() !== ""
      );
      if (headingBlock && headingBlock.content) {
        tocItems.push({ id: item.id, label: headingBlock.content });
      }
    }
  });

  const currentIndex = projects.findIndex((p) => p.slug === slug);
  const showNavigation = projects.length > 1 && currentIndex !== -1;
  const prevProject = showNavigation ? projects[(currentIndex - 1 + projects.length) % projects.length] : null;
  const nextProject = showNavigation ? projects[(currentIndex + 1) % projects.length] : null;

  return (
    <div className="min-h-screen bg-[var(--bg-1)] transition-colors duration-200 relative">
      {/* ── Left sidebar ── */}
      <div
        className="fixed top-[160px] w-[200px] flex-col items-start gap-3 z-20 hidden xl:flex"
        style={{ left: "calc(50% - 468px - var(--scrollbar-width, 0px) / 2)" }}
      >
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 px-[10px] py-[10px] rounded-full font-medium text-base leading-5 text-[var(--text-p)] transition-all duration-200 hover:bg-[var(--bg-4)] active:scale-95"
        >
          <span className="flex items-center justify-center w-5 h-5">
            <ArrowLeftIcon />
          </span>
          <span className="px-1">Project</span>
        </Link>
        <ThemeToggle />
      </div>

      {/* ── Right TOC sidebar ── */}
      {tocItems.length > 1 && (
        <div
          className="fixed top-[160px] w-[180px] z-20 hidden xl:block"
          style={{ left: "calc(50% + 380px - var(--scrollbar-width, 0px) / 2)" }}
        >
          <TableOfContents items={tocItems} />
        </div>
      )}

      {/* ── Mobile top bar ── */}
      <div className="flex xl:hidden items-center justify-between px-5 pt-8 pb-0">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1 px-3 py-2 rounded-full font-medium text-sm text-[var(--text-p)] transition-all duration-200 hover:bg-[var(--bg-4)]"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          <span>Project</span>
        </Link>
        <ThemeToggle />
      </div>

      {/* ── Main content ── */}
      <main className="flex flex-col items-center w-full max-w-[720px] mx-auto px-5 py-10 xl:px-6 xl:pt-[160px] xl:pb-[60px]">
        <section id="overview" className="flex flex-col items-start w-full scroll-mt-24">
          <div className="flex flex-col items-start w-full pt-[10px]">
            <h1 className="w-full text-base font-medium leading-5 text-[var(--text-title)]">
              {project.title || project.slug}
            </h1>
            <p className="w-full text-base font-normal leading-6 text-[var(--text-subtitle)]">
              {[project.category, project.year].filter(Boolean).join(" · ")}
            </p>
          </div>

          {/* Description (Açıklama) */}
          {project.description && (
            <div className="w-full mt-6">
              <TextScrollingEffect>
                <p className="text-base font-light leading-7 text-[var(--text-p)] whitespace-pre-wrap">
                  {project.description}
                </p>
              </TextScrollingEffect>
            </div>
          )}

          {/* Cover Image (Resim) */}
          {project.coverImage && (
            <div
              className="relative w-full rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] overflow-hidden mt-12 mb-6"
              style={{ aspectRatio: "940/518" }}
            >
              <ZoomableImage
                src={project.coverImage}
                alt={project.title || project.slug}
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </section>

        {project.items.map((item: PageItem) =>
          item.kind === "divider" ? (
            <div key={item.id} className="w-full">
              <DetailDivider />
            </div>
          ) : (
            <div key={item.id} className="w-full">
              <DetailSection section={item} />
            </div>
          )
        )}

        {showNavigation && (prevProject || nextProject) && (
          <div className="flex flex-col gap-12 items-start pt-16 w-full">
            <div className="w-full h-px bg-[var(--border)]" />
            <div className="flex items-start justify-between w-full gap-4 sm:flex-row flex-col">
              {prevProject && (
                <Link href={`/projects/${prevProject.slug}`} className="flex flex-col gap-0.5 flex-1 min-w-0 group cursor-pointer">
                  <span className="text-sm font-normal leading-5 text-[var(--text-subtitle)] transition-colors duration-200 group-hover:text-[var(--text-p)]">Previous</span>
                  <span className="text-sm font-medium leading-5 text-[var(--text-title)] truncate">{prevProject.title || prevProject.slug}</span>
                </Link>
              )}
              {nextProject && (
                <Link href={`/projects/${nextProject.slug}`} className="flex flex-col gap-0.5 items-start sm:items-end flex-1 min-w-0 group cursor-pointer">
                  <span className="text-sm font-normal leading-5 text-[var(--text-subtitle)] transition-colors duration-200 group-hover:text-[var(--text-p)]">Next</span>
                  <span className="text-sm font-medium leading-5 text-[var(--text-title)] truncate">{nextProject.title || nextProject.slug}</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
