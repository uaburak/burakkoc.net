"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { listProjects } from "@/lib/firestore";
import { ProjectData } from "@/types/project";

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
      <div className="flex items-center justify-between px-6 pt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-subtitle)] hover:text-[var(--text-p)] transition-colors duration-200"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 2.5L4 7l5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Burak Koç
        </Link>
        <ThemeToggle />
      </div>

      <main className="max-w-[720px] mx-auto px-6 pt-16 pb-24">
        <h1 className="text-base font-medium text-[var(--text-title)] mb-8">Projeler</h1>

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
                <svg className="w-4 h-4 text-[var(--text-subtitle)]" viewBox="0 0 16 16" fill="none">
                  <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
