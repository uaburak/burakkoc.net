"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
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
import PageEntrance from "@/components/PageEntrance";
import { TopBar } from "@/components/TopBar";
import { CodeHighlight } from "@/components/CodeHighlight";

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
              {hasCode ? (
                <CodeHighlight code={block.content ?? ""} language={block.language ?? "javascript"} />
              ) : (
                <div className="p-5 sm:p-6 opacity-30 italic font-mono text-xs text-[var(--text-subtitle)]">{"// kod girilmedi"}</div>
              )}
            </div>
          ) : usedTab === "Preview" ? (
            <div className="bg-[var(--bg-3)] p-5 sm:p-6">
              {hasPreview ? (
                <div dangerouslySetInnerHTML={{ __html: block.codePreview ?? "" }} />
              ) : (
                <div className="flex items-center justify-center h-24 text-sm text-[var(--text-subtitle)] opacity-30 italic font-light select-none">
                  HTML önizlemesi girilmedi
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

function getProjectCoverImage(proj?: ProjectData | null): string | null {
  if (!proj) return null;
  if (proj.coverImage) return proj.coverImage;
  for (const item of proj.items) {
    if (item.kind === "section") {
      const imgBlock = item.blocks.find((b) => b.type === "image" && b.src);
      if (imgBlock?.src) return imgBlock.src;
    }
  }
  return null;
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

  const footerCardRef = useRef<HTMLDivElement>(null);
  const footerImageRef = useRef<HTMLImageElement>(null);
  const [footerActiveImage, setFooterActiveImage] = useState<string | null>(null);

  const handleMouseEnterPrev = (proj: ProjectData) => {
    const img = getProjectCoverImage(proj);
    if (!img) return;
    setFooterActiveImage(img);

    if (footerCardRef.current) {
      gsap.to(footerCardRef.current, {
        left: "0%",
        opacity: 1,
        scale: 1,
        duration: 0.4,
        ease: "power3.out",
        overwrite: "auto",
      });
    }
  };

  const handleMouseMovePrev = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!footerCardRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;

    gsap.to(footerCardRef.current, {
      left: "0%",
      x: relX * 20,
      rotation: relX * 6,
      opacity: 1,
      scale: 1,
      duration: 0.3,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  const handleMouseEnterNext = (proj: ProjectData) => {
    const img = getProjectCoverImage(proj);
    if (!img) return;
    setFooterActiveImage(img);

    if (footerCardRef.current) {
      gsap.to(footerCardRef.current, {
        left: "50%",
        opacity: 1,
        scale: 1,
        duration: 0.4,
        ease: "power3.out",
        overwrite: "auto",
      });
    }
  };

  const handleMouseMoveNext = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!footerCardRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;

    gsap.to(footerCardRef.current, {
      left: "50%",
      x: relX * 20,
      rotation: relX * 6,
      opacity: 1,
      scale: 1,
      duration: 0.3,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  const handleMouseLeaveFooter = () => {
    if (!footerCardRef.current) return;
    gsap.to(footerCardRef.current, {
      opacity: 0,
      scale: 0.95,
      x: 0,
      rotation: 0,
      duration: 0.35,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  useEffect(() => {
    if (footerActiveImage && footerImageRef.current) {
      gsap.fromTo(
        footerImageRef.current,
        { scale: 1.15 },
        { scale: 1, duration: 0.45, ease: "power2.out" }
      );
    }
  }, [footerActiveImage]);

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

  const prevImg = getProjectCoverImage(prevProject);
  const nextImg = getProjectCoverImage(nextProject);

  return (
    <PageEntrance className="min-h-screen bg-[var(--bg-1)] transition-colors duration-200 relative">
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

      {/* ── Top bar (xl altı) — içerik sütunuyla aynı hizada ── */}
      <TopBar backHref="/projects" backLabel="Project" showThemeToggle={false} className="xl:hidden" />

      {/* ── Main content ── */}
      <main className="flex flex-col items-start w-full max-w-[720px] mx-auto px-5 pt-10 pb-[60px] xl:px-6 xl:pt-[160px] xl:pb-[60px]">
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
          <div
            className="flex flex-col gap-12 items-start pt-16 w-full"
            onMouseLeave={handleMouseLeaveFooter}
          >
            <div className="w-full h-px bg-[var(--border)]" />
            <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-0 w-full">
              {/* Single Shared Footer Preview Card */}
              <div
                ref={footerCardRef}
                className="absolute pointer-events-none hidden md:block w-1/2 aspect-[16/9] origin-bottom rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--bg-2)] shadow-[0_16px_40px_rgba(0,0,0,0.18)] opacity-0 scale-95 will-change-transform z-30"
                style={{ bottom: "calc(100% + 12px)", left: "0%" }}
              >
                {footerActiveImage && (
                  <img
                    ref={footerImageRef}
                    src={footerActiveImage}
                    alt="Project Preview"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>

              {prevProject ? (
                <Link
                  href={`/projects/${prevProject.slug}`}
                  onMouseEnter={() => handleMouseEnterPrev(prevProject)}
                  onMouseMove={handleMouseMovePrev}
                  className="relative group flex flex-col gap-0.5 justify-center flex-1 min-w-0 cursor-pointer p-3.5 sm:p-4 rounded-2xl transition-all duration-200 hover:bg-[var(--bg-4)] active:scale-[0.98]"
                >
                  <span className="text-sm font-normal leading-5 text-[var(--text-subtitle)] transition-colors duration-200 group-hover:text-[var(--text-p)]">
                    Previous
                  </span>
                  <span className="text-sm font-medium leading-5 text-[var(--text-title)] truncate">
                    {prevProject.title || prevProject.slug}
                  </span>
                </Link>
              ) : (
                <div />
              )}

              {nextProject ? (
                <Link
                  href={`/projects/${nextProject.slug}`}
                  onMouseEnter={() => handleMouseEnterNext(nextProject)}
                  onMouseMove={handleMouseMoveNext}
                  className="relative group flex flex-col gap-0.5 items-start sm:items-end justify-center flex-1 min-w-0 cursor-pointer p-3.5 sm:p-4 rounded-2xl transition-all duration-200 hover:bg-[var(--bg-4)] active:scale-[0.98]"
                >
                  <span className="text-sm font-normal leading-5 text-[var(--text-subtitle)] transition-colors duration-200 group-hover:text-[var(--text-p)]">
                    Next
                  </span>
                  <span className="text-sm font-medium leading-5 text-[var(--text-title)] truncate">
                    {nextProject.title || nextProject.slug}
                  </span>
                </Link>
              ) : (
                <div />
              )}
            </div>
          </div>
        )}
      </main>
    </PageEntrance>
  );
}
