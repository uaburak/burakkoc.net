"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Spinner } from "@/components/icons";
import { DesignSystemProvider } from "@/components/project/designSystem";
import { FigmaEditor } from "@/figma/FigmaEditor";
import { useEditSession } from "@/figma/session";

/**
 * The project's editor: Figma, for its page (see FigmaEditor) — the project
 * and the site's design system loaded, edited in memory and written back
 * only with Save (see useEditSession).
 */
export function AdminEditorClient({ slug }: { slug: string }) {
  const session = useEditSession(slug);
  const { status, file, system, meta } = session;

  if (status.kind !== "ready" || !file || !system || !meta) {
    return (
      <div className="flex flex-col h-full bg-[var(--bg-1)]">
        <header className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-1)] select-none">
          <Link href="/admin/projects" className="inline-flex items-center h-10 gap-1.5 px-3 rounded-full text-sm font-medium text-[var(--text-p)] hover:bg-[var(--bg-4)] transition-colors duration-200 shrink-0">
            Projeler
          </Link>
          <ThemeToggle />
        </header>
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          {status.kind === "loading" && <Spinner className="w-6 h-6 text-[var(--text-subtitle)]" />}
          {status.kind === "missing" && (
            <>
              <p className="text-base font-medium text-[var(--text-title)]">“{slug}” adında bir proje yok</p>
              <p className="text-sm text-[var(--text-subtitle)]">Projeler listesinden yeni bir proje oluşturabilirsin.</p>
            </>
          )}
          {status.kind === "error" && (
            <>
              <p className="text-base font-medium text-[var(--text-title)]">Proje açılamadı</p>
              <p className="max-w-[420px] text-sm text-[var(--text-subtitle)]">{status.message}</p>
              <p className="max-w-[420px] text-sm text-[var(--text-subtitle)]">Hiçbir şey değiştirilmedi ve kaydedilmedi.</p>
              <button type="button" onClick={() => window.location.reload()} className="mt-2 h-9 px-4 rounded-full border border-[var(--border)] text-sm text-[var(--text-p)] hover:bg-[var(--bg-4)] cursor-pointer">
                Tekrar dene
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DesignSystemProvider variables={system.variables} textStyles={system.textStyles}>
        <FigmaEditor doc={file} onDoc={session.onDoc} title={meta.title} slug={slug} system={system} session={session} undo={session.undo} redo={session.redo} />
      </DesignSystemProvider>
    </div>
  );
}
