"use client";

import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ChevronRight } from "@/components/icons";
import { ProjectData } from "@/types/project";
import TextScrollingEffect from "@/components/TextScrollingEffect";

export default function ProjectsClient({ initialProjects }: { initialProjects: ProjectData[] }) {
  return (
    <div className="min-h-screen bg-[var(--bg-1)] transition-colors duration-200">
      <PageHeader backHref="/" backLabel="Burak Koç" />

      <main className="max-w-[720px] mx-auto px-6 pt-16 pb-24">
        <TextScrollingEffect>
          <h1 className="text-base font-medium text-[var(--text-title)] mb-8">Projeler</h1>
        </TextScrollingEffect>

        {initialProjects.length === 0 && (
          <p className="text-sm font-light text-[var(--text-subtitle)] opacity-50 italic">
            Henüz proje yok.
          </p>
        )}

        {initialProjects.length > 0 && (
          <div className="flex flex-col gap-0">
            {initialProjects.map((project) => (
              <Link
                key={project.slug}
                href={`/projects/${project.slug}`}
                className="group flex items-center justify-between py-4 border-b border-[var(--border)] transition-all duration-200 hover:opacity-60"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-base font-medium text-[var(--text-title)]">
                    {project.title || project.slug}
                  </span>
                  {(project.category || project.year) && (
                    <span className="text-sm font-light text-[var(--text-subtitle)]">
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
    </div>
  );
}
