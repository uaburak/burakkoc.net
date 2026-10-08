"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { ArrowLeftIcon, ChevronRight, ExternalSmall, Spinner } from "@/components/icons";
import { PillButton } from "@/components/Button";
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
      await deleteProjectFolder(project.slug).catch((err) =>
        console.warn("Storage cleanup partially failed:", err)
      );
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
      <div
        className="fixed inset-0 z-40 bg-[var(--bg-1)]/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] shadow-xl p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium text-[var(--text-title)]">Projeyi Sil</h2>
            <p className="text-xs text-[var(--text-subtitle)] leading-relaxed">
              Bu işlem geri alınamaz. Onaylamak için aşağıdaki kutuya{" "}
              <strong className="text-[var(--text-title)] font-mono">{project.slug}</strong> yazın.
            </p>
          </div>

          <input
            ref={inputRef}
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={project.slug}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-1)] px-4 py-2.5 text-xs font-mono text-[var(--text-p)] placeholder:text-[var(--text-subtitle)] focus:outline-none focus:border-red-400 transition-colors duration-150"
          />

          {error && <p className="text-xs text-red-500">{error}</p>}

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
              className="flex-1 px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 text-sm font-medium hover:bg-red-500/20 transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
  const [title, setTitle] = useState("");
  const [slug, setSlug]   = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!slugEdited) {
      setSlug(slugify(val));
    }
  }

  function handleSlugChange(val: string) {
    setSlugEdited(true);
    setSlug(slugify(val));
  }

  async function handleCreate() {
    if (!slug) return;
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
      <div
        className="fixed inset-0 z-40 bg-[var(--bg-1)]/60 backdrop-blur-sm"
        onClick={onClose}
      />
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

          {error && <p className="text-xs text-red-500 -mt-2">{error}</p>}

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

// ── Main Admin Projects Page ──────────────────────────────────────────────────

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

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[var(--bg-1)] flex items-center justify-center">
        <Spinner className="w-6 h-6 text-[var(--text-subtitle)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-1)] transition-colors duration-200 relative">
      {/* ── Left Sidebar (Desktop XL): Geri (Admin) ── */}
      <div
        className="fixed top-[160px] w-[200px] flex-col items-start gap-1 z-20 hidden xl:flex"
        style={{ left: "calc(50% - 468px - var(--scrollbar-width, 0px) / 2)" }}
      >
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 px-[10px] py-[10px] rounded-full font-medium text-base leading-5 text-[var(--text-p)] transition-all duration-200 hover:bg-[var(--bg-4)] active:scale-95"
        >
          <span className="flex items-center justify-center w-5 h-5">
            <ArrowLeftIcon />
          </span>
          <span className="px-1">Admin</span>
        </Link>
      </div>

      {/* ── Main content (matches /projects page layout) ── */}
      <main className="flex flex-col items-start w-full max-w-[720px] mx-auto px-5 pt-10 pb-[60px] xl:px-6 xl:pt-[160px] xl:pb-[60px]">
        {/* Project list with "Yeni Proje" as the first top row */}
        <div className="flex flex-col gap-0 w-full">
            {/* ── En Üst Row: Yeni Proje ── */}
            <div
              onClick={() => setShowCreate(true)}
              className="group flex items-center justify-between py-[10px] border-b border-[var(--border)] transition-all duration-150 hover:bg-[var(--bg-3)] cursor-pointer"
            >
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-base font-medium leading-5 text-[var(--text-title)]">
                  Yeni Proje
                </span>
              </div>

              <div className="flex items-center gap-2 ml-4 shrink-0">
                <span className="flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border)] text-[var(--text-subtitle)] group-hover:border-[var(--border-hover)] group-hover:text-[var(--text-title)] group-hover:bg-[var(--bg-4)] transition-all duration-150">
                  <PlusIcon />
                </span>
              </div>
            </div>
            {projects.map((project) => (
              <div
                key={project.slug}
                onClick={() => router.push(`/admin/projects/${project.slug}`)}
                className="group flex items-center justify-between py-[10px] border-b border-[var(--border)] transition-all duration-150 hover:bg-[var(--bg-3)] cursor-pointer"
              >
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-base font-medium leading-5 text-[var(--text-title)] truncate">
                    {project.title || project.slug}
                  </span>
                  {(project.category || project.year) && (
                    <span className="text-base font-normal leading-6 text-[var(--text-subtitle)] truncate">
                      {[project.category, project.year].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <a
                    href={`/projects/${project.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border)] text-[var(--text-subtitle)] hover:border-[var(--border-hover)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-all duration-150"
                    title="Canlıda görüntüle"
                  >
                    <ExternalSmall />
                  </a>

                  <button
                    type="button"
                    onClick={() => router.push(`/admin/projects/${project.slug}`)}
                    className="flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border)] text-[var(--text-subtitle)] hover:border-[var(--border-hover)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-all duration-150 cursor-pointer"
                    title="Projeyi düzenle"
                  >
                    <EditIcon />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeleteTarget(project)}
                    title="Projeyi sil"
                    className="flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border)] text-[var(--text-subtitle)] hover:border-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-all duration-150 cursor-pointer"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
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
