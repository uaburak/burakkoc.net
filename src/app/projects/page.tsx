"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ChevronRight } from "@/components/icons";
import { listProjects } from "@/lib/firestore";
import { ProjectData } from "@/types/project";
import TextScrollingEffect from "@/components/TextScrollingEffect";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listProjects()
      .then(setProjects)
      .catch((err) => console.error("Failed to load projects:", err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-1)] transition-colors duration-200">
      <PageHeader backHref="/" backLabel="Burak Koç" />

      <main className="max-w-[720px] mx-auto px-6 pt-16 pb-24">
        <TextScrollingEffect>
          <h1 className="text-base font-medium text-[var(--text-title)] mb-8">Projeler</h1>
        </TextScrollingEffect>

        {loading && (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="py-4 border-b border-[var(--border)] animate-pulse">
                <div className="h-4 w-48 rounded bg-[var(--bg-3)]" />
                <div className="h-3 w-24 rounded bg-[var(--bg-3)] mt-2" />
              </div>
            ))}
          </div>
        )}

        {!loading && projects.length === 0 && (
          <p className="text-sm font-light text-[var(--text-subtitle)] opacity-50 italic">
            Henüz proje yok.
          </p>
        )}

        {!loading && projects.length > 0 && (
          <div className="flex flex-col gap-0">
            {projects.map((project) => (
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
