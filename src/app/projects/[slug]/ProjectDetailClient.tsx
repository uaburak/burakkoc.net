"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ArrowLeftIcon } from "@/components/icons";
import { TableOfContents, type TocItem } from "@/components/TableOfContents";
import { loadProject, listProjects } from "@/lib/firestore";
import { ProjectData, PageSection, PageItem } from "@/types/project";
import TextScrollingEffect from "@/components/TextScrollingEffect";
import { ZoomableImage } from "@/components/ZoomableImage";
import PageEntrance from "@/components/PageEntrance";
import { projectThemeAttrs } from "@/components/project/projectTheme";
import { ProjectDivider } from "@/components/project/CoreBlocks";
import { SectionContent, pageFrameProps, sectionWidthClass } from "@/components/project/LayoutGrid";
import { sectionBlocks } from "@/lib/projectLayout";
import { DesignSystemProvider, DesignSystemStyle, fromStored, type SiteDesign } from "@/components/project/designSystem";
import { frameLookStyle } from "@/components/project/frameLook";
import { PageView } from "@/figma/PageView";

// ── Sections ──────────────────────────────────────────────────────────────────

function DetailSection({ section }: { section: PageSection }) {
  return (
    <section id={section.id} className="w-full pt-10 scroll-mt-24">
      <SectionContent section={section} animate />
    </section>
  );
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

      <main className="flex flex-col items-center w-full max-w-[720px] mx-auto px-5 pt-10 pb-[60px] xl:px-6 xl:pt-[160px] xl:pb-[60px]">
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
  for (const item of (proj.items || [])) {
    if (item.kind === "section") {
      const imgBlock = sectionBlocks(item).find((b) => b.type === "image" && b.src);
      if (imgBlock?.src) return imgBlock.src;
    }
  }
  return null;
}

interface ProjectDetailFooterNavProps {
  prevProject: ProjectData | null;
  nextProject: ProjectData | null;
}

function ProjectDetailFooterNav({ prevProject, nextProject }: ProjectDetailFooterNavProps) {
  const prevImg = getProjectCoverImage(prevProject);
  const nextImg = getProjectCoverImage(nextProject);

  const footerCardRef = useRef<HTMLDivElement>(null);
  const prevImgWrapperRef = useRef<HTMLDivElement>(null);
  const nextImgWrapperRef = useRef<HTMLDivElement>(null);
  const quickXRef = useRef<((val: number) => void) | null>(null);
  const quickRotRef = useRef<((val: number) => void) | null>(null);

  useEffect(() => {
    if (!footerCardRef.current) return;
    quickXRef.current = gsap.quickTo(footerCardRef.current, "x", {
      duration: 0.25,
      ease: "power2.out",
    });
    quickRotRef.current = gsap.quickTo(footerCardRef.current, "rotation", {
      duration: 0.25,
      ease: "power2.out",
    });
  }, []);

  const handleMouseEnterPrev = () => {
    if (!footerCardRef.current) return;
    if (prevImgWrapperRef.current) prevImgWrapperRef.current.style.opacity = "1";
    if (nextImgWrapperRef.current) nextImgWrapperRef.current.style.opacity = "0";

    gsap.to(footerCardRef.current, {
      xPercent: 0,
      opacity: 1,
      scale: 1,
      duration: 0.35,
      ease: "power3.out",
      overwrite: "auto",
    });
  };

  const handleMouseMovePrev = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    quickXRef.current?.(relX * 16);
    quickRotRef.current?.(relX * 4);
  };

  const handleMouseEnterNext = () => {
    if (!footerCardRef.current) return;
    if (prevImgWrapperRef.current) prevImgWrapperRef.current.style.opacity = "0";
    if (nextImgWrapperRef.current) nextImgWrapperRef.current.style.opacity = "1";

    gsap.to(footerCardRef.current, {
      xPercent: 100,
      opacity: 1,
      scale: 1,
      duration: 0.35,
      ease: "power3.out",
      overwrite: "auto",
    });
  };

  const handleMouseMoveNext = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    quickXRef.current?.(relX * 16);
    quickRotRef.current?.(relX * 4);
  };

  const handleMouseLeaveFooter = () => {
    if (!footerCardRef.current) return;
    quickXRef.current?.(0);
    quickRotRef.current?.(0);
    gsap.to(footerCardRef.current, {
      opacity: 0,
      scale: 0.95,
      duration: 0.3,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  if (!prevProject && !nextProject) return null;

  return (
    <div
      className="flex flex-col gap-12 items-start pt-16 w-full"
      onMouseLeave={handleMouseLeaveFooter}
    >
      <div className="w-full h-px bg-[var(--border)]" />
      <div className="relative grid grid-cols-2 gap-2 sm:gap-0 w-full">
        {/* Single Shared Footer Preview Card - Accelerated via GPU xPercent & transform */}
        <div
          ref={footerCardRef}
          className="absolute pointer-events-none hidden md:block w-1/2 aspect-[16/9] origin-bottom rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--bg-2)] shadow-[0_16px_40px_rgba(0,0,0,0.18)] opacity-0 scale-95 will-change-transform z-30"
          style={{ bottom: "calc(100% + 12px)", left: 0 }}
        >
          {prevImg && (
            <div
              ref={prevImgWrapperRef}
              className="absolute inset-0 transition-opacity duration-200"
              style={{ opacity: 0 }}
            >
              <img
                src={prevImg}
                alt={prevProject?.title || "Previous Project"}
                className="w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
            </div>
          )}
          {nextImg && (
            <div
              ref={nextImgWrapperRef}
              className="absolute inset-0 transition-opacity duration-200"
              style={{ opacity: 0 }}
            >
              <img
                src={nextImg}
                alt={nextProject?.title || "Next Project"}
                className="w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
            </div>
          )}
        </div>

        {prevProject ? (
          <Link
            href={`/projects/${prevProject.slug}`}
            onMouseEnter={handleMouseEnterPrev}
            onMouseMove={handleMouseMovePrev}
            className="relative group flex flex-col gap-0.5 justify-center flex-1 min-w-0 cursor-pointer p-3.5 sm:p-4 rounded-2xl transition-colors duration-200 hover:bg-[var(--bg-4)] active:scale-[0.98]"
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
            onMouseEnter={handleMouseEnterNext}
            onMouseMove={handleMouseMoveNext}
            className="relative group flex flex-col gap-0.5 items-end justify-center flex-1 min-w-0 cursor-pointer p-3.5 sm:p-4 rounded-2xl transition-colors duration-200 hover:bg-[var(--bg-4)] active:scale-[0.98]"
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
  );
}

// ── Main Client Component ─────────────────────────────────────────────────────

interface ProjectDetailClientProps {
  slug: string;
  initialProject?: ProjectData | null;
  initialProjects?: ProjectData[];
  /** The site's design system as stored: its variables, text styles and components */
  design?: SiteDesign;
}

export function ProjectDetailClient({
  slug,
  initialProject,
  initialProjects,
  design = { variables: [], textStyles: [], components: [] },
}: ProjectDetailClientProps) {
  const [project, setProject] = useState<ProjectData | null>(initialProject || null);
  const [projects, setProjects] = useState<ProjectData[]>(initialProjects || []);
  const [loading, setLoading] = useState(!initialProject);

  useEffect(() => {
    if (initialProject) {
      setProject(initialProject);
      if (initialProjects && initialProjects.length > 0) {
        setProjects(initialProjects);
      } else {
        listProjects()
          .then(setProjects)
          .catch((err) => console.error("Failed to list projects:", err));
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

  const pageFrame = pageFrameProps(project.frame);
  const site = fromStored(design);
  // Hidden sections (their look's eye) are left out — no room, no contents entry.
  const items = project.items.filter((item) => item.kind !== "section" || !item.look?.hidden);
  const tocItems: TocItem[] = [{ id: "overview", label: "Overview" }];
  items.forEach((item) => {
    if (item.kind === "section") {
      const headingBlock = sectionBlocks(item).find(
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

  // Plain call, not a hook: this runs after the early returns above.
  const themeAttrs = projectThemeAttrs(project.theme);

  // Made in the Figma editor: its page frame is the page.
  if (project.canvas) {
    return (
      <DesignSystemProvider {...site}>
        <PageEntrance className="min-h-screen bg-[var(--bg-1)] transition-colors duration-200 relative" data-design-scope="">
          <DesignSystemStyle />
          <main className="w-full">
            <PageView doc={project.canvas} variables={site.variables} />
            {showNavigation && (
              <div className="w-full max-w-[720px] mx-auto px-5 pb-[60px] xl:px-6">
                <ProjectDetailFooterNav prevProject={prevProject} nextProject={nextProject} />
              </div>
            )}
          </main>
        </PageEntrance>
      </DesignSystemProvider>
    );
  }

  return (
    <DesignSystemProvider {...site}>
    <PageEntrance
      className="min-h-screen bg-[var(--bg-1)] transition-colors duration-200 relative"
      {...themeAttrs}
      data-design-scope=""
    >
      <DesignSystemStyle />
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
          className="fixed top-[160px] w-[320px] 2xl:w-[260px] max-w-[calc(50vw-400px)] z-20 hidden xl:block"
          style={{ left: "calc(50% + 380px - var(--scrollbar-width, 0px) / 2)" }}
        >
          <TableOfContents items={tocItems} />
        </div>
      )}

      {/* ── Main content ── */}
      <main className="flex flex-col items-start w-full max-w-[720px] mx-auto px-5 pt-10 pb-[60px] xl:px-6 xl:pt-[160px] xl:pb-[60px]">
        {/* The page's frame (PageFrame): its header, sections and dividers, sized and aligned as set in the editor. */}
        <div className={pageFrame.className} style={{ ...pageFrame.style, ...frameLookStyle(project.frame?.look, site.variables) }}>
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

          {items.map((item: PageItem) =>
            item.kind === "divider" ? (
              <div key={item.id} className="w-full">
                <ProjectDivider />
              </div>
            ) : (
              <div key={item.id} className={sectionWidthClass(item)}>
                <DetailSection section={item} />
              </div>
            )
          )}
        </div>

        {showNavigation && (
          <ProjectDetailFooterNav
            prevProject={prevProject}
            nextProject={nextProject}
          />
        )}
      </main>
    </PageEntrance>
    </DesignSystemProvider>
  );
}
