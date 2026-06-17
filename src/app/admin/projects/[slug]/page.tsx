import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdminEditorClient } from "./AdminEditorClient";
import { EditorProvider, EditorNavControls } from "@/components/admin/EditorNavControls";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return {
    title: `Admin — ${slug} | Portfolio`,
  };
}

export default async function AdminProjectPage({ params }: Props) {
  const { slug } = await params;

  return (
    <EditorProvider>
      <div className="h-screen overflow-hidden flex flex-col bg-[var(--bg-1)] transition-colors duration-200">
        {/* ── Top nav ── */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-[var(--border)] bg-[var(--bg-1)]">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/projects"
              className="inline-flex items-center h-10 gap-1.5 px-3 rounded-full text-sm font-medium text-[var(--text-p)] hover:bg-[var(--bg-4)] transition-colors duration-200"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Projeler
            </Link>
            <div className="w-px h-4 bg-[var(--border)]" />
            <span className="text-sm text-[var(--text-subtitle)] font-mono">/admin/projects/{slug}</span>
          </div>
          <div className="flex items-center gap-2">
            <EditorNavControls />
            <ThemeToggle />
          </div>
        </div>

        {/* ── Split editor (fills remaining height) ── */}
        <div className="flex-1 min-h-0">
          <AdminEditorClient slug={slug} />
        </div>
      </div>
    </EditorProvider>
  );
}

