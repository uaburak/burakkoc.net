"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ArrowLeftIcon } from "@/components/icons";
import { TableOfContents, type TocItem } from "@/components/TableOfContents";
import type { ProjectSummary, PublishedPage } from "@/types/project";
import PageEntrance from "@/components/PageEntrance";
import { DesignSystemProvider, DesignSystemStyle } from "@/components/project/designSystem";
import { withStartingVariables } from "@/components/project/designVariables";
import { withStartingTextStyles } from "@/components/project/textStyles";
import { PageView } from "@/figma/PageView";
import { pageFrameOf } from "@/figma/page";
import { BASE_LANGUAGE, libraryOf, writtenLanguages, type LangCode } from "@/figma/model";
import { headingsOf } from "@/figma/site";

// ── Beside the page: the way back, the contents ───────────────────────────────

/** The way back to the projects, fixed at the column's left (wide screens). */
/** The page's own words (the way back, the contents, before / after), in the language shown. */
const WORDS: Record<"tr" | "en", { back: string; overview: string; previous: string; next: string }> = {
  tr: { back: "Projeler", overview: "Genel bakış", previous: "Önceki", next: "Sonraki" },
  en: { back: "Projects", overview: "Overview", previous: "Previous", next: "Next" },
};
const wordsFor = (lang: LangCode) => WORDS[lang === BASE_LANGUAGE ? "tr" : "en"];

// ── The language shown: ?lang=… (a link that says it), else the visitor's last choice, else the base ──

const LANG_KEY = "site-lang";
const LANG_EVENT = "site-lang";
const subscribeLang = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(LANG_EVENT, cb);
  window.addEventListener("popstate", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(LANG_EVENT, cb);
    window.removeEventListener("popstate", cb);
  };
};
const langSnapshot = () => {
  try {
    return new URLSearchParams(window.location.search).get("lang") ?? localStorage.getItem(LANG_KEY) ?? BASE_LANGUAGE;
  } catch {
    return BASE_LANGUAGE;
  }
};
function chooseLang(code: LangCode) {
  try {
    localStorage.setItem(LANG_KEY, code);
  } catch { /* the address keeps it */ }
  const url = new URL(window.location.href);
  if (code === BASE_LANGUAGE) url.searchParams.delete("lang");
  else url.searchParams.set("lang", code);
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new Event(LANG_EVENT));
}

/** The page's languages, to switch between (only when it has more than one). */
function LanguageSwitch({ languages, lang, className }: { languages: { code: LangCode; name: string }[]; lang: LangCode; className?: string }) {
  if (languages.length < 2) return null;
  return (
    <div role="group" aria-label="Language" className={`inline-flex items-center gap-0.5 p-0.5 rounded-full border border-[var(--border)] bg-[var(--bg-2)] ${className ?? ""}`}>
      {languages.map((l) => (
        <button key={l.code} type="button" lang={l.code} aria-pressed={l.code === lang} title={l.name} onClick={() => chooseLang(l.code)} className={`h-7 px-2.5 rounded-full text-xs font-medium uppercase transition-colors ${l.code === lang ? "bg-[var(--bg-4)] text-[var(--text-title)]" : "text-[var(--text-subtitle)] hover:text-[var(--text-title)]"}`}>
          {l.code}
        </button>
      ))}
    </div>
  );
}

function BackToProjects({ label, languages, lang }: { label: string; languages: { code: LangCode; name: string }[]; lang: LangCode }) {
  return (
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
        <span className="px-1">{label}</span>
      </Link>
      <LanguageSwitch languages={languages} lang={lang} className="ml-[10px]" />
    </div>
  );
}

/** The page's contents, fixed at the column's right (wide screens) — when it has sections to list. */
function PageContents({ items }: { items: TocItem[] }) {
  if (items.length <= 1) return null;
  return (
    <div
      className="fixed top-[160px] w-[320px] 2xl:w-[260px] max-w-[calc(50vw-400px)] z-20 hidden xl:block"
      style={{ left: "calc(50% + 380px - var(--scrollbar-width, 0px) / 2)" }}
    >
      <TableOfContents items={items} />
    </div>
  );
}

interface ProjectDetailFooterNavProps {
  prevProject: ProjectSummary | null;
  nextProject: ProjectSummary | null;
  words: { previous: string; next: string };
}

function ProjectDetailFooterNav({ prevProject, nextProject, words }: ProjectDetailFooterNavProps) {
  const prevImg = prevProject?.coverImage || null;
  const nextImg = nextProject?.coverImage || null;

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
              {/* eslint-disable-next-line @next/next/no-img-element -- a hover preview of the bucket's file, as it is */}
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
              {/* eslint-disable-next-line @next/next/no-img-element -- a hover preview of the bucket's file, as it is */}
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
              {words.previous}
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
              {words.next}
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

// ── The page ──────────────────────────────────────────────────────────────────

/**
 * A published project's page: its page frame as it was published (see
 * PublishedPage) — the way back and its contents beside it (the contents
 * list its sections' headings; neither is a layer of the file), the
 * projects before and after it under it.
 */
export function ProjectDetailClient({ page, prev, next }: { page: PublishedPage; prev: ProjectSummary | null; next: ProjectSummary | null }) {
  const variables = withStartingVariables(page.variables);
  const textStyles = withStartingTextStyles(page.textStyles);
  const frame = pageFrameOf(page.doc);
  // The language shown: one of the page's that has words of its own in it (the base where the one asked for isn't).
  const languages = writtenLanguages(page.doc);
  const asked = useSyncExternalStore(subscribeLang, langSnapshot, () => BASE_LANGUAGE);
  const lang = languages.some((l) => l.code === asked) ? asked : BASE_LANGUAGE;
  const words = wordsFor(lang);
  const contents: TocItem[] = [{ id: "overview", label: words.overview }, ...(frame ? headingsOf(frame, libraryOf(page.doc), lang) : [])];
  return (
    <DesignSystemProvider variables={variables} textStyles={textStyles}>
      <PageEntrance className="min-h-screen bg-[var(--bg-1)] transition-colors duration-200 relative" data-design-scope="">
        <DesignSystemStyle />
        <BackToProjects label={words.back} languages={languages} lang={lang} />
        <PageContents items={contents} />
        <main className="w-full pb-[60px]">
          {/* (Narrower screens: the language switch at the page's top.) */}
          {languages.length > 1 && (
            <div className="xl:hidden flex justify-end w-full max-w-[720px] mx-auto px-5 pt-6">
              <LanguageSwitch languages={languages} lang={lang} />
            </div>
          )}
          <PageView doc={page.doc} variables={variables} lang={lang} />
          {(prev || next) && (
            <div className="w-full max-w-[720px] mx-auto px-5 xl:px-6">
              <ProjectDetailFooterNav prevProject={prev} nextProject={next} words={words} />
            </div>
          )}
        </main>
      </PageEntrance>
    </DesignSystemProvider>
  );
}
