"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeftIcon, ExternalSmall, Spinner } from "@/components/icons";
import { SlugTakenError, createProject, deleteProject, duplicateProject, listProjects, loadDesign, reorderProjects, unpublishProject } from "@/lib/firestore";
import { slugify, slugProblem } from "@/lib/slug";
import type { ProjectFields, ProjectMeta } from "@/types/project";
import { newDocument } from "@/figma/model";
import { overviewFields, withOverview, withOverviewTitle } from "@/figma/overview";
import { currentLibrary, splitLibrary, withLibrary } from "@/figma/systemLibrary";
import { errorText } from "@/figma/session";

// ── Icons ─────────────────────────────────────────────────────────────────────

const icon = (d: ReactNode) => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
    {d}
  </svg>
);
const PlusIcon = () => icon(<path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />);
const EditIcon = () => icon(<path d="M9.5 2.5l2 2L4 12H2v-2l7.5-7.5z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />);
const CopyIcon = () => icon(<><rect x="4.5" y="4.5" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.25" /><path d="M9.5 4.5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v5.5a1 1 0 001 1h1.5" stroke="currentColor" strokeWidth="1.25" /></>);
const TrashIcon = () => icon(<path d="M2 4h10M5 4V2.5h4V4M5.5 6.5v4M8.5 6.5v4M3 4l.7 7.5c.05.55.5.97 1.05.97h4.5c.55 0 1-.42 1.05-.97L11 4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />);
const GripIcon = () => icon(<>{[3, 7, 11].map((y) => [5, 9].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="currentColor" />))}</>);
const UnpublishIcon = () => icon(<><path d="M2 7s1.8-3.5 5-3.5S12 7 12 7s-1.8 3.5-5 3.5S2 7 2 7z" stroke="currentColor" strokeWidth="1.25" /><path d="M2.5 11.5l9-9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" /></>);

const ROUND = "flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border)] text-[var(--text-subtitle)] hover:border-[var(--border-hover)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-all duration-150 cursor-pointer";
const INPUT = "w-full rounded-xl border border-[var(--border)] bg-[var(--bg-2)] px-4 py-2.5 text-sm text-[var(--text-p)] placeholder:text-[var(--text-subtitle)] focus:outline-none focus:border-[var(--border-hover)] transition-colors duration-150";

const when = (ms: number | null) => (ms ? new Date(ms).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" }) : null);

// ── Dialogs ───────────────────────────────────────────────────────────────────

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="fixed inset-0 z-40 bg-[var(--bg-1)]/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center px-6 pointer-events-none">
        <div role="dialog" aria-label={title} className="pointer-events-auto w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] shadow-xl p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--text-title)]">{title}</h2>
            <button type="button" aria-label="Kapat" onClick={onClose} className="flex items-center justify-center w-6 h-6 rounded-lg text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-colors duration-150 cursor-pointer">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

function DialogButtons({ onCancel, confirm, busy, disabled, danger = false, onConfirm }: { onCancel: () => void; confirm: string; busy?: string | null; disabled?: boolean; danger?: boolean; onConfirm: () => void }) {
  return (
    <div className="flex gap-2">
      <button type="button" onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] text-sm text-[var(--text-subtitle)] hover:bg-[var(--bg-4)] hover:text-[var(--text-p)] transition-colors duration-150 cursor-pointer">
        İptal
      </button>
      <button
        type="button"
        onClick={onConfirm}
        disabled={disabled || Boolean(busy)}
        className={danger
          ? "flex-1 px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-500 text-sm font-medium hover:bg-red-500/20 transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          : "flex-1 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--text-title)] text-[var(--bg-1)] text-sm font-medium hover:opacity-80 transition-opacity duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"}
      >
        {busy ?? confirm}
      </button>
    </div>
  );
}

/** A title and its slug: the slug follows the title until it is typed in; what a slug can't hold, or one taken, is said under it. */
function TitleAndSlug({ taken, onSubmit, submit, busy, onCancel, initialTitle = "" }: { taken: ReadonlySet<string>; onSubmit: (title: string, slug: string) => void; submit: string; busy: string | null; onCancel: () => void; initialTitle?: string }) {
  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(() => slugify(initialTitle));
  const [slugEdited, setSlugEdited] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => titleRef.current?.focus(), []);
  const problem = slug ? slugProblem(slug) ?? (taken.has(slug) ? "Bu slug zaten kullanılıyor — başka bir slug gir." : null) : null;
  const ready = Boolean(title.trim() && slug && !problem);
  const go = () => ready && !busy && onSubmit(title.trim(), slug);
  return (
    <>
      <div className="flex flex-col gap-3">
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
          onKeyDown={(e) => e.key === "Enter" && go()}
          placeholder="Başlık"
          aria-label="Başlık"
          className={INPUT}
        />
        <div className="flex flex-col gap-1.5">
          <div className="relative">
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlugEdited(true);
                setSlug(e.target.value.trim());
              }}
              onKeyDown={(e) => e.key === "Enter" && go()}
              placeholder="slug"
              aria-label="Slug"
              aria-invalid={Boolean(problem)}
              spellCheck={false}
              autoCapitalize="off"
              className={`${INPUT} font-mono text-xs ${problem ? "border-red-400 focus:border-red-400" : ""}`}
            />
            {slug && !problem && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--text-subtitle)] opacity-50 select-none">/projects/{slug}</span>}
          </div>
          <p className={`text-xs leading-4 ${problem ? "text-red-500" : "text-[var(--text-subtitle)]"}`}>{problem ?? "Yalnızca a–z, 0–9 ve tire. Sonradan değiştirilemez."}</p>
        </div>
      </div>
      <DialogButtons onCancel={onCancel} confirm={submit} busy={busy} disabled={!ready} onConfirm={go} />
    </>
  );
}

function CreateProjectDialog({ taken, onClose, onCreated }: { taken: ReadonlySet<string>; onClose: () => void; onCreated: (slug: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const create = async (title: string, slug: string) => {
    setBusy("Oluşturuluyor…");
    setError("");
    try {
      // Its page made with the site's library: the Overview first, the template's example in it to fill in.
      const library = currentLibrary((await loadDesign()).library);
      const base: ProjectFields = { slug, title, category: "", year: new Date().getFullYear().toString() };
      const file = withOverview(withLibrary(newDocument(title), library), base);
      await createProject({ ...base, ...(overviewFields(file) ?? {}), title }, splitLibrary(file).project);
      onCreated(slug);
    } catch (err) {
      setError(err instanceof SlugTakenError ? "Bu slug zaten kullanılıyor — başka bir slug gir." : `Oluşturulamadı: ${errorText(err)}`);
      setBusy(null);
    }
  };
  return (
    <Dialog title="Yeni Proje" onClose={onClose}>
      <TitleAndSlug taken={taken} onSubmit={(t, s) => void create(t, s)} submit="Oluştur" busy={busy} onCancel={onClose} />
      {error && <p className="text-xs text-red-500 -mt-2">{error}</p>}
      <p className="text-xs leading-4 text-[var(--text-subtitle)] -mt-2">Taslak olarak oluşturulur; editörde “Publish” ile sitede yayınlanır.</p>
    </Dialog>
  );
}

function DuplicateDialog({ project, taken, onClose, onDone }: { project: ProjectMeta; taken: ReadonlySet<string>; onClose: () => void; onDone: (slug: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const duplicate = async (title: string, slug: string) => {
    setBusy("Çoğaltılıyor…");
    setError("");
    try {
      await duplicateProject(project.slug, { slug, title }, (canvas) => withOverviewTitle(canvas, title));
      onDone(slug);
    } catch (err) {
      setError(err instanceof SlugTakenError ? "Bu slug zaten kullanılıyor — başka bir slug gir." : `Çoğaltılamadı: ${errorText(err)}`);
      setBusy(null);
    }
  };
  return (
    <Dialog title={`“${project.title || project.slug}” projesini çoğalt`} onClose={onClose}>
      <TitleAndSlug taken={taken} initialTitle={`${project.title || project.slug} (kopya)`} onSubmit={(t, s) => void duplicate(t, s)} submit="Çoğalt" busy={busy} onCancel={onClose} />
      {error && <p className="text-xs text-red-500 -mt-2">{error}</p>}
    </Dialog>
  );
}

function DeleteConfirmDialog({ project, onClose, onDeleted }: { project: ProjectMeta; onClose: () => void; onDeleted: (slug: string) => void }) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  const matches = confirmText === project.slug;
  const remove = async () => {
    if (!matches) return;
    setBusy("Siliniyor…");
    setError("");
    try {
      await deleteProject(project.slug);
      onDeleted(project.slug);
    } catch (err) {
      setError(`Silinemedi: ${errorText(err)}`);
      setBusy(null);
    }
  };
  return (
    <Dialog title="Projeyi Sil" onClose={onClose}>
      <p className="text-xs text-[var(--text-subtitle)] leading-relaxed -mt-2">
        Taslak, kayıtlı sürümleri ve {project.published ? "sitedeki yayını" : "varsa yayını"} silinir; bu geri alınamaz. Görselleri Storage’da kalır (başka sayfalarda kullanılıyor olabilirler).
        Onaylamak için <strong className="text-[var(--text-title)] font-mono">{project.slug}</strong> yaz.
      </p>
      <input ref={inputRef} type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void remove()} placeholder={project.slug} aria-label="Slug ile onayla" className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-1)] px-4 py-2.5 text-xs font-mono text-[var(--text-p)] placeholder:text-[var(--text-subtitle)] focus:outline-none focus:border-red-400 transition-colors duration-150" />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <DialogButtons onCancel={onClose} confirm="Sil" busy={busy} disabled={!matches} danger onConfirm={() => void remove()} />
    </Dialog>
  );
}

// ── A project's row ───────────────────────────────────────────────────────────

function Status({ project }: { project: ProjectMeta }) {
  const [label, tone] = !project.published ? ["Taslak", "bg-[var(--bg-4)] text-[var(--text-subtitle)]"] : project.changedSincePublish ? ["Yayında · değişti", "bg-amber-500/10 text-amber-600"] : ["Yayında", "bg-green-500/10 text-green-600"];
  return <span title={project.published && project.changedSincePublish ? "Taslak, yayındaki sürümden sonra kaydedildi: editörde Update ile yayınla" : undefined} className={`shrink-0 inline-flex items-center h-5 px-2 rounded-full text-[11px] font-medium leading-none ${tone}`}>{label}</span>;
}

// ── The page ──────────────────────────────────────────────────────────────────

export default function AdminProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<{ kind: "create" } | { kind: "duplicate" | "delete"; project: ProjectMeta } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const taken = useMemo(() => new Set(projects.map((p) => p.slug)), [projects]);

  const reload = () =>
    listProjects()
      .then((list) => {
        setProjects(list);
        setLoadError("");
      })
      .catch((err) => setLoadError(errorText(err)))
      .finally(() => setLoading(false));
  useEffect(() => {
    void reload();
  }, []);

  /** The new order written (each project's place; the site's lists follow) — put back as it was when it fails. */
  const reorder = async (next: ProjectMeta[]) => {
    const before = projects;
    setProjects(next);
    try {
      await reorderProjects(next);
      setNotice("");
    } catch (err) {
      setProjects(before);
      setNotice(`Sıralama kaydedilemedi: ${errorText(err)}`);
    }
  };
  const drop = (target: string) => {
    if (!dragging || dragging === target) return;
    const list = projects.filter((p) => p.slug !== dragging);
    const moved = projects.find((p) => p.slug === dragging)!;
    const at = list.findIndex((p) => p.slug === target);
    const from = projects.findIndex((p) => p.slug === dragging);
    const to = projects.findIndex((p) => p.slug === target);
    list.splice(from < to ? at + 1 : at, 0, moved);
    void reorder(list);
  };
  const move = (slug: string, by: -1 | 1) => {
    const i = projects.findIndex((p) => p.slug === slug);
    const j = i + by;
    if (i < 0 || j < 0 || j >= projects.length) return;
    const list = [...projects];
    [list[i], list[j]] = [list[j], list[i]];
    void reorder(list);
  };
  const unpublish = async (project: ProjectMeta) => {
    if (!window.confirm(`“${project.title || project.slug}” siteden kaldırılsın mı? Taslağı burada kalır.`)) return;
    try {
      await unpublishProject(project.slug);
      setProjects((list) => list.map((p) => (p.slug === project.slug ? { ...p, published: false, publishedAt: null } : p)));
    } catch (err) {
      setNotice(`Yayından kaldırılamadı: ${errorText(err)}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-[var(--bg-1)] flex items-center justify-center">
        <Spinner className="w-6 h-6 text-[var(--text-subtitle)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-1)] transition-colors duration-200 relative">
      <div className="fixed top-[160px] w-[200px] flex-col items-start gap-1 z-20 hidden xl:flex" style={{ left: "calc(50% - 468px - var(--scrollbar-width, 0px) / 2)" }}>
        <Link href="/admin" className="inline-flex items-center gap-1 px-[10px] py-[10px] rounded-full font-medium text-base leading-5 text-[var(--text-p)] transition-all duration-200 hover:bg-[var(--bg-4)] active:scale-95">
          <span className="flex items-center justify-center w-5 h-5"><ArrowLeftIcon /></span>
          <span className="px-1">Admin</span>
        </Link>
      </div>

      <main className="flex flex-col items-start w-full max-w-[720px] mx-auto px-5 pt-10 pb-[60px] xl:px-6 xl:pt-[160px] xl:pb-[60px]">
        {loadError && (
          <div role="alert" className="w-full mb-4 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-sm text-red-500">
            Projeler yüklenemedi: {loadError} <button type="button" onClick={() => void reload()} className="underline cursor-pointer">Tekrar dene</button>
          </div>
        )}
        {notice && <div role="status" className="w-full mb-4 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-3)] text-sm text-[var(--text-p)]">{notice}</div>}
        <div className="flex flex-col gap-0 w-full">
          <button type="button" onClick={() => setDialog({ kind: "create" })} className="group flex items-center justify-between py-[10px] border-b border-[var(--border)] transition-all duration-150 hover:bg-[var(--bg-3)] cursor-pointer text-left">
            <span className="text-base font-medium leading-5 text-[var(--text-title)]">Yeni Proje</span>
            <span className="flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border)] text-[var(--text-subtitle)] group-hover:border-[var(--border-hover)] group-hover:text-[var(--text-title)] group-hover:bg-[var(--bg-4)] transition-all duration-150">
              <PlusIcon />
            </span>
          </button>
          {!projects.length && !loadError && <p className="py-6 text-sm text-[var(--text-subtitle)]">Henüz proje yok.</p>}
          {projects.map((project, i) => (
            <div
              key={project.slug}
              draggable
              onDragStart={(e) => {
                setDragging(project.slug);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                setOver(project.slug);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(project.slug);
                setOver(null);
              }}
              className={`group flex items-center gap-3 py-[10px] border-b transition-all duration-150 hover:bg-[var(--bg-3)] ${over === project.slug && dragging !== project.slug ? "border-[var(--text-title)]" : "border-[var(--border)]"} ${dragging === project.slug ? "opacity-40" : ""}`}
            >
              <span title="Sürükleyerek sırala" className="shrink-0 text-[var(--text-subtitle)] opacity-0 group-hover:opacity-60 cursor-grab active:cursor-grabbing"><GripIcon /></span>
              <Link href={`/admin/projects/${project.slug}`} className="flex flex-1 min-w-0 items-center gap-3">
                <span className="shrink-0 w-14 h-9 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-4)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {project.coverImage && <img src={project.coverImage} alt="" loading="lazy" className="w-full h-full object-cover" />}
                </span>
                <span className="flex flex-col flex-1 min-w-0">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-base font-medium leading-5 text-[var(--text-title)] truncate">{project.title || project.slug}</span>
                    <Status project={project} />
                  </span>
                  <span className="text-sm font-normal leading-5 text-[var(--text-subtitle)] truncate">
                    {[[project.category, project.year].filter(Boolean).join(" · "), when(project.updatedAt) && `kaydedildi ${when(project.updatedAt)}`].filter(Boolean).join(" — ") || project.slug}
                  </span>
                </span>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                <span className="hidden sm:flex flex-col opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                  <button type="button" aria-label="Yukarı taşı" disabled={i === 0} onClick={() => move(project.slug, -1)} className="h-4 px-1 text-[10px] leading-none text-[var(--text-subtitle)] hover:text-[var(--text-title)] disabled:opacity-30 cursor-pointer">▲</button>
                  <button type="button" aria-label="Aşağı taşı" disabled={i === projects.length - 1} onClick={() => move(project.slug, 1)} className="h-4 px-1 text-[10px] leading-none text-[var(--text-subtitle)] hover:text-[var(--text-title)] disabled:opacity-30 cursor-pointer">▼</button>
                </span>
                {project.published && (
                  <>
                    <a href={`/projects/${project.slug}`} target="_blank" rel="noopener noreferrer" className={ROUND} title="Sitede görüntüle"><ExternalSmall /></a>
                    <button type="button" onClick={() => void unpublish(project)} className={ROUND} title="Yayından kaldır"><UnpublishIcon /></button>
                  </>
                )}
                <button type="button" onClick={() => router.push(`/admin/projects/${project.slug}`)} className={ROUND} title="Düzenle"><EditIcon /></button>
                <button type="button" onClick={() => setDialog({ kind: "duplicate", project })} className={ROUND} title="Çoğalt"><CopyIcon /></button>
                <button type="button" onClick={() => setDialog({ kind: "delete", project })} title="Sil" className="flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border)] text-[var(--text-subtitle)] hover:border-red-500/40 hover:text-red-500 hover:bg-red-500/10 transition-all duration-150 cursor-pointer"><TrashIcon /></button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {dialog?.kind === "create" && <CreateProjectDialog taken={taken} onClose={() => setDialog(null)} onCreated={(slug) => router.push(`/admin/projects/${slug}`)} />}
      {dialog?.kind === "duplicate" && (
        <DuplicateDialog
          project={dialog.project}
          taken={taken}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            void reload();
          }}
        />
      )}
      {dialog?.kind === "delete" && (
        <DeleteConfirmDialog
          project={dialog.project}
          onClose={() => setDialog(null)}
          onDeleted={(slug) => {
            setProjects((prev) => prev.filter((p) => p.slug !== slug));
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}
