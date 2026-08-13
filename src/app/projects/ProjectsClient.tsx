"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { TopBar } from "@/components/TopBar";
import { ArrowLeftIcon, ChevronRight } from "@/components/icons";
import { ProjectData } from "@/types/project";
import PageEntrance from "@/components/PageEntrance";

export default function ProjectsClient({ initialProjects }: { initialProjects: ProjectData[] }) {
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const xTo = useRef<gsap.QuickToFunc | null>(null);
  const yTo = useRef<gsap.QuickToFunc | null>(null);
  const rotateTo = useRef<gsap.QuickToFunc | null>(null);

  const prevMousePos = useRef({ x: 0, y: 0 });
  const idleTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initial GSAP setup for container
    gsap.set(containerRef.current, {
      xPercent: -50,
      yPercent: -50,
      opacity: 0,
      scale: 0.75,
      pointerEvents: "none",
    });

    // 60fps quickTo helpers for smooth cursor tracking
    xTo.current = gsap.quickTo(containerRef.current, "x", { duration: 0.35, ease: "power3.out" });
    yTo.current = gsap.quickTo(containerRef.current, "y", { duration: 0.35, ease: "power3.out" });
    rotateTo.current = gsap.quickTo(containerRef.current, "rotation", { duration: 0.4, ease: "power3.out" });

    const handleMouseMove = (e: MouseEvent) => {
      if (xTo.current && yTo.current) {
        xTo.current(e.clientX);
        yTo.current(e.clientY);
      }

      // Dynamic tilt based on horizontal velocity
      const deltaX = e.clientX - prevMousePos.current.x;
      prevMousePos.current = { x: e.clientX, y: e.clientY };

      if (rotateTo.current) {
        const rotation = Math.max(-12, Math.min(12, deltaX * 0.25));
        rotateTo.current(rotation);
      }

      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        rotateTo.current?.(0);
      }, 100);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  // Inner image reveal transition on project change
  useEffect(() => {
    if (activeImage && imageRef.current) {
      gsap.fromTo(
        imageRef.current,
        { scale: 1.15 },
        { scale: 1, duration: 0.45, ease: "power2.out" }
      );
    }
  }, [activeImage]);

  const handleMouseEnterProject = (project: ProjectData) => {
    let imgUrl = project.coverImage;
    if (!imgUrl) {
      for (const item of project.items) {
        if (item.kind === "section") {
          const imgBlock = item.blocks.find((b) => b.type === "image" && b.src);
          if (imgBlock?.src) {
            imgUrl = imgBlock.src;
            break;
          }
        }
      }
    }

    if (imgUrl) {
      setActiveImage(imgUrl);
      if (containerRef.current) {
        gsap.to(containerRef.current, {
          opacity: 1,
          scale: 1,
          duration: 0.35,
          ease: "power2.out",
          overwrite: "auto",
        });
      }
    } else {
      handleMouseLeaveProject();
    }
  };

  const handleMouseLeaveProject = () => {
    if (containerRef.current) {
      gsap.to(containerRef.current, {
        opacity: 0,
        scale: 0.75,
        duration: 0.3,
        ease: "power2.out",
        overwrite: "auto",
      });
    }
  };

  return (
    <PageEntrance className="min-h-screen bg-[var(--bg-1)] transition-colors duration-200 relative">
      {/* ── GSAP Cursor-Tracking Image Preview ── */}
      <div
        ref={containerRef}
        className="fixed top-0 left-0 z-50 pointer-events-none hidden md:block w-[280px] sm:w-[320px] aspect-[16/10] rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--bg-2)] shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
      >
        {activeImage && (
          <img
            ref={imageRef}
            src={activeImage}
            alt="Project Preview"
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* ── Left sidebar ── */}
      <div
        className="fixed top-[160px] w-[200px] flex-col items-start gap-3 z-20 hidden xl:flex"
        style={{ left: "calc(50% - 468px - var(--scrollbar-width, 0px) / 2)" }}
      >
        <Link
          href="/"
          className="inline-flex items-center gap-1 px-[10px] py-[10px] rounded-full font-medium text-base leading-5 text-[var(--text-p)] transition-all duration-200 hover:bg-[var(--bg-4)] active:scale-95"
        >
          <span className="flex items-center justify-center w-5 h-5">
            <ArrowLeftIcon />
          </span>
          <span className="px-1">Home</span>
        </Link>
      </div>

      {/* ── Main content ── */}
      <main className="flex flex-col items-start w-full max-w-[720px] mx-auto px-5 pt-10 pb-[60px] xl:px-6 xl:pt-[160px] xl:pb-[60px]">
        {/* Mobile-only Header Title Block */}
        <div className="flex flex-col items-start w-full pt-[10px] pb-6 xl:hidden">
          <h1 className="w-full text-base font-medium leading-5 text-[var(--text-title)]">
            Projects
          </h1>
          <p className="w-full text-base font-normal leading-6 text-[var(--text-subtitle)]">
            Selected works & case studies
          </p>
        </div>

        {initialProjects.length === 0 && (
          <p className="text-sm font-light text-[var(--text-subtitle)] opacity-50 italic">
            Henüz proje yok.
          </p>
        )}

        {initialProjects.length > 0 && (
          <div
            className="flex flex-col gap-0 w-full"
            onMouseLeave={handleMouseLeaveProject}
          >
            {initialProjects.map((project) => (
              <Link
                key={project.slug}
                href={`/projects/${project.slug}`}
                onMouseEnter={() => handleMouseEnterProject(project)}
                className="group flex items-center justify-between py-[10px] border-b border-[var(--border)] transition-all duration-150 hover:bg-[var(--bg-3)]"
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-base font-medium leading-5 text-[var(--text-title)]">
                    {project.title || project.slug}
                  </span>
                  {(project.category || project.year) && (
                    <span className="text-base font-normal leading-6 text-[var(--text-subtitle)]">
                      {[project.category, project.year].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </div>
                <ChevronRight />
              </Link>
            ))}
          </div>
        )}
      </main>
    </PageEntrance>
  );
}
