"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ChevronRight, ExternalSmall } from "@/components/icons";
import { listProjects, saveProject, deleteProject } from "@/lib/firestore";
import { deleteProjectFolder } from "@/lib/storage";
import { ProjectData } from "@/types/project";

// ── Slug helpers ──────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M9.5 2.5l2 2L4 12H2v-2l7.5-7.5z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M2 4h10M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3 4l.7 7.5c.05.55.5.97 1.05.97h4.5c.55 0 1-.42 1.05-.97L11 4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ChevronRight ve ExternalSmall icons.tsx'den import edildi

// ── Delete Confirm Dialog ────────────────────────────────────────────────────────

function DeleteConfirmDialog({
  project,
  onClose,
  onDeleted,
}: {
  project: ProjectData;
  onClose: () => void;
  onDeleted: (slug: string) => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const slugMatch = confirmText === project.slug;

  async function handleDelete() {
    if (!slugMatch) return;
    setDeleting(true);
    setError("");
    try {
      // 1. Delete all Storage files first (best-effort)
      await deleteProjectFolder(project.slug).catch((err) =>
        console.warn("Storage cleanup partially failed:", err)
      );
      // 2. Delete Firestore document
      await deleteProject(project.slug);
      onDeleted(project.slug);
    } catch (err) {
      console.error(err);
      setError("Silme işlemi başarısız oldu. Tekrar deneyin.");
      setDeleting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && slugMatch) handleDelete();
    if (e.key === "Escape") onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-[var(--bg-1)]/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] shadow-xl p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--text-title)]">Projeyi Sil</h2>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-6 h-6 rounded-lg text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-colors duration-150 cursor-pointer"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm text-[var(--text-subtitle)] leading-relaxed">
              <span className="text-[var(--text-p)] font-medium">{project.title || project.slug}</span>
              {" "}projesini silmek üzeresiniz. Firestore belgesi ve tüm Storage dosyaları kalıcı olarak silinecek.
            </p>
            <p className="text-xs text-[var(--text-subtitle)] opacity-70">
              Onaylamak için slug&apos;ı yazın:
              {" "}<span className="font-mono text-[var(--text-p)]">{project.slug}</span>
            </p>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={project.slug}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-2)] px-4 py-2.5 text-sm font-mono text-[var(--text-p)] placeholder:text-[var(--text-subtitle)] focus:outline-none focus:border-red-500/50 transition-colors duration-150"
          />

          {error && (
            <p className="text-xs text-red-500 -mt-2">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-subtitle)] hover:bg-[var(--bg-4)] hover:text-[var(--text-p)] transition-colors duration-150 cursor-pointer"
            >
              İptal
            </button>
            <button
              onClick={handleDelete}
              disabled={!slugMatch || deleting}
              className="flex-1 px-4 py-2.5 rounded-xl border border-red-500/40 bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {deleting ? "Siliniyor…" : "Sil"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Create Project Dialog ─────────────────────────────────────────────────────

function CreateProjectDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (slug: string) => void;
}) {
  const [title, setTitle]     = useState("");
  const [slug, setSlug]       = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError]     = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!slugEdited) setSlug(slugify(val));
  }

  function handleSlugChange(val: string) {
    setSlugEdited(true);
    setSlug(slugify(val) || val.toLowerCase());
  }

  async function handleCreate() {
    if (!slug) { setError("Slug gerekli."); return; }
    setCreating(true);
    setError("");
    try {
      const newProject: ProjectData = {
        slug,
        title: title || slug,
        category: "",
        year: new Date().getFullYear().toString(),
        items: [],
      };
      await saveProject(newProject);
      onCreate(slug);
    } catch (err) {
      console.error(err);
      setError("Oluşturulamadı. Slug zaten kullanılıyor olabilir.");
      setCreating(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleCreate();
    if (e.key === "Escape") onClose();
  }

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-2)] px-4 py-2.5 text-sm text-[var(--text-p)] placeholder:text-[var(--text-subtitle)] focus:outline-none focus:border-[var(--border-hover)] transition-colors duration-150";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-[var(--bg-1)]/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] shadow-xl p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--text-title)]">Yeni Proje</h2>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-6 h-6 rounded-lg text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-colors duration-150 cursor-pointer"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col gap-3">
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Başlık"
              className={inputClass}
            />
            <div className="relative">
              <input
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="slug"
                className={`${inputClass} font-mono text-xs`}
              />
              {slug && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-subtitle)] opacity-50 select-none">
                  /projects/{slug}
                </span>
              )}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 -mt-2">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-subtitle)] hover:bg-[var(--bg-4)] hover:text-[var(--text-p)] transition-colors duration-150 cursor-pointer"
            >
              İptal
            </button>
            <button
              onClick={handleCreate}
              disabled={!slug || creating}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--text-title)] text-[var(--bg-1)] text-sm font-medium hover:opacity-80 transition-opacity duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? "Oluşturuluyor…" : "Oluştur"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectData | null>(null);

  useEffect(() => {
    listProjects()
      .then((data) => setProjects(data.sort((a, b) => a.title.localeCompare(b.title))))
      .catch((err) => console.error("Failed to load projects:", err))
      .finally(() => setLoading(false));
  }, []);

  function handleCreated(slug: string) {
    router.push(`/admin/projects/${slug}`);
  }

  function handleDeleted(slug: string) {
    setProjects((prev) => prev.filter((p) => p.slug !== slug));
    setDeleteTarget(null);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-1)] transition-colors duration-200">
      {/* Top nav */}
      <PageHeader backHref="/admin" backLabel="Admin" />

      <main className="max-w-[720px] mx-auto px-6 pt-16 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-base font-medium text-[var(--text-title)]">Projeler</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium border border-[var(--border)] bg-[var(--bg-2)] text-[var(--text-p)] hover:bg-[var(--bg-4)] hover:border-[var(--border-hover)] transition-all duration-200 cursor-pointer"
          >
            <PlusIcon />
            Yeni Proje
          </button>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="flex flex-col gap-0">
            {[1, 2, 3].map((i) => (
              <div key={i} className="py-4 border-b border-[var(--border)] animate-pulse flex items-center justify-between">
                <div className="flex flex-col gap-1.5">
                  <div className="h-3.5 w-44 rounded bg-[var(--bg-3)]" />
                  <div className="h-3 w-24 rounded bg-[var(--bg-3)]" />
                </div>
                <div className="h-8 w-16 rounded-xl bg-[var(--bg-3)]" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && projects.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm font-light text-[var(--text-subtitle)] opacity-50">Henüz proje yok.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="text-sm text-[var(--text-subtitle)] hover:text-[var(--text-p)] underline underline-offset-4 transition-colors cursor-pointer"
            >
              İlk projeyi oluştur
            </button>
          </div>
        )}

        {/* Project list */}
        {!loading && projects.length > 0 && (
          <div className="flex flex-col gap-0">
            {projects.map((project) => (
              <div
                key={project.slug}
                className="flex items-center justify-between py-4 border-b border-[var(--border)]"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-base font-medium text-[var(--text-title)] truncate">
                    {project.title || project.slug}
                  </span>
                  <span className="text-sm font-light text-[var(--text-subtitle)]">
                    {[project.category, project.year].filter(Boolean).join(" · ") || project.slug}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <Link
                    href={`/projects/${project.slug}`}
                    target="_blank"
                    className="flex items-center justify-center w-8 h-8 rounded-xl border border-[var(--border)] text-[var(--text-subtitle)] hover:border-[var(--border-hover)] hover:text-[var(--text-title)] transition-colors duration-150"
                    title="Canlıda görüntüle"
                  >
                    <ExternalSmall />
                  </Link>
                  <Link
                    href={`/admin/projects/${project.slug}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-p)] hover:bg-[var(--bg-4)] hover:border-[var(--border-hover)] transition-all duration-150"
                  >
                    <EditIcon />
                    Düzenle
                  </Link>
                  <button
                    onClick={() => setDeleteTarget(project)}
                    className="flex items-center justify-center w-8 h-8 rounded-xl border border-[var(--border)] text-[var(--text-subtitle)] hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/10 transition-colors duration-150 cursor-pointer"
                    title="Projeyi sil"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create dialog */}
      {showCreate && (
        <CreateProjectDialog
          onClose={() => setShowCreate(false)}
          onCreate={handleCreated}
        />
      )}

      {/* Delete confirm dialog */}
      {deleteTarget && (
        <DeleteConfirmDialog
          project={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
