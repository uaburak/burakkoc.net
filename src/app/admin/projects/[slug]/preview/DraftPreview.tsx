"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Spinner } from "@/components/icons";
import { loadDesign, loadProjectForEdit } from "@/lib/firestore";
import type { PublishedPage } from "@/types/project";
import { withStartingVariables } from "@/components/project/designVariables";
import { withStartingTextStyles } from "@/components/project/textStyles";
import { newDocument, upgradeDocument } from "@/figma/model";
import { overviewFields, withOverview } from "@/figma/overview";
import { publishedPage } from "@/figma/publish";
import { currentLibrary, detachDeleted, withLibrary } from "@/figma/systemLibrary";
import { errorText } from "@/figma/session";
import { ProjectDetailClient } from "@/app/projects/[slug]/ProjectDetailClient";

/** The saved draft as the site would show it once published — only for the admin (it reads the draft). */
export function DraftPreview({ slug }: { slug: string }) {
  const [page, setPage] = useState<PublishedPage | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([loadProjectForEdit(slug), loadDesign()])
      .then(([project, design]) => {
        if (!project) return setError(`“${slug}” adında bir proje yok.`);
        const library = currentLibrary(design.library);
        const variables = withStartingVariables(design.variables);
        const own = detachDeleted(project.canvas ? upgradeDocument(project.canvas) : newDocument(project.meta.title || slug), library, design.deletedVariables, variables, design.deletedTextStyles);
        const file = withOverview(withLibrary(own, library), project.meta);
        setPage(publishedPage(file, { ...project.meta, ...(overviewFields(file) ?? {}) }, project.meta.order, variables, withStartingTextStyles(design.textStyles)));
      })
      .catch((err) => setError(errorText(err)));
  }, [slug]);
  if (error) return <p className="p-10 text-sm text-red-500">{error}</p>;
  if (!page) return <div className="min-h-screen flex items-center justify-center"><Spinner className="w-6 h-6 text-[var(--text-subtitle)]" /></div>;
  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 h-10 pl-4 pr-1.5 rounded-full bg-[var(--text-title)] text-[var(--bg-1)] text-xs shadow-lg">
        Kaydedilmiş taslağın önizlemesi — sitede değil
        <Link href={`/admin/projects/${slug}`} className="h-7 px-3 inline-flex items-center rounded-full bg-[var(--bg-1)] text-[var(--text-title)] font-medium">Editöre dön</Link>
      </div>
      <ProjectDetailClient page={page} prev={null} next={null} />
    </>
  );
}
