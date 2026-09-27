"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProjectData } from "@/types/project";
import { useEditorContext, EditorNavControls } from "@/components/admin/EditorNavControls";
import { saveProject, loadProject, getCVData } from "@/lib/firestore";
import { createProjectTemplate } from "@/lib/projectTemplate";
import { PillButton } from "@/components/Button";
import { Segmented } from "@/components/Segmented";
import { Spinner } from "@/components/icons";
import { AddMenu } from "@/components/admin/AddMenu";
import { PlusIcon } from "@/components/admin/blockCatalog";
import { FormEditor } from "@/components/admin/FormEditor";
import { LiveEditor } from "@/components/admin/LiveEditor";
import { ProjectDndProvider } from "@/components/admin/ProjectDnd";
import { useEditorActions } from "@/components/admin/editorActions";
import { normalizeItems } from "@/lib/projectLayout";
import { DesignSystemProvider } from "@/components/project/designSystem";
import { useDesignSystem } from "@/components/admin/useDesignSystem";

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_PROJECT: ProjectData = {
  slug: "",
  title: "",
  titleEn: "",
  category: "",
  year: new Date().getFullYear().toString(),
  coverImage: "",
  description: "",
  descriptionEn: "",
  items: [],
};

const STORAGE_KEY = "admin_project_draft";
const MODE_KEY = "admin_editor_mode";

type EditorMode = "form" | "live";
const MODES: { value: EditorMode; label: string }[] = [
  { value: "form", label: "Blok Düzenleyici" },
  { value: "live", label: "Canlı Düzenleyici" },
];

function readMode(): EditorMode {
  if (typeof window === "undefined") return "form";
  try {
    return localStorage.getItem(MODE_KEY) === "live" ? "live" : "form";
  } catch {
    return "form";
  }
}

// ── Draft cache ───────────────────────────────────────────────────────────────

/** Reads the local draft, migrating the old `sections` shape to `items`. */
function readDraft(slug: string): ProjectData | null {
  try {
    const cached = localStorage.getItem(`${STORAGE_KEY}_${slug}`);
    if (!cached) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed = JSON.parse(cached) as any;
    if (!parsed.items && Array.isArray(parsed.sections)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parsed.items = parsed.sections.map((s: any) => ({ ...s, kind: "section" }));
      delete parsed.sections;
    }
    parsed.items = Array.isArray(parsed.items) ? normalizeItems(parsed.items) : [];
    return { ...parsed, slug };
  } catch {
    return null;
  }
}

// ── Main editor ───────────────────────────────────────────────────────────────

export function AdminEditorClient({ slug }: { slug: string }) {
  // Always start with the empty base so server and client render identically.
  // localStorage is read in useEffect (client-only) to avoid hydration mismatch.
  const [project, setProject] = useState<ProjectData>({ ...EMPTY_PROJECT, slug });
  const actions = useEditorActions(setProject);

  // ── Shared state from EditorContext (language + save button in the header) ──
  const { editLang, setSaveStatus, registerSave } = useEditorContext();

  // The chosen editor is remembered between visits. Reading it in the initializer
  // is hydration-safe: the first render is always the loading spinner.
  const [mode, setMode] = useState<EditorMode>(readMode);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [loadingFromDB, setLoadingFromDB] = useState(true);
  /** Whether this project exists in Firestore (i.e. has been published at least once) */
  const [isPublished, setIsPublished] = useState(false);
  const [companies, setCompanies] = useState<string[]>([]);
  // The site's design system — variables, atoms, main components: edited here, saved with the project — they change every page.
  const system = useDesignSystem();

  function changeMode(next: EditorMode) {
    setMode(next);
    try { localStorage.setItem(MODE_KEY, next); } catch { /* ignore */ }
  }

  useEffect(() => {
    getCVData()
      .then((cv) => setCompanies(Array.from(new Set(cv.experience.map((e) => e.company.trim()).filter(Boolean)))))
      .catch((err) => console.error("Failed to load CV companies for select:", err));
  }, []);

  // ── Load from Firestore on mount — always enforce URL slug ──
  useEffect(() => {
    loadProject(slug)
      .then((data) => {
        if (data) {
          if (!Array.isArray(data.items)) data.items = [];
          const normalized = { ...data, slug };
          setProject(normalized);
          setIsPublished(true);
          localStorage.setItem(`${STORAGE_KEY}_${slug}`, JSON.stringify(normalized));
        } else {
          // No Firestore data — fall back to the local draft
          const draft = readDraft(slug);
          setProject((p) => draft ?? (p.slug !== slug ? { ...p, slug } : p));
        }
      })
      .catch((err) => {
        console.warn("Firestore load failed, using local cache:", err);
        const draft = readDraft(slug);
        if (draft) setProject(draft);
      })
      .finally(() => setLoadingFromDB(false));
  }, [slug]);

  // ── Mirror to localStorage for offline / fast-reload ──
  useEffect(() => {
    if (!loadingFromDB) {
      localStorage.setItem(`${STORAGE_KEY}_${slug}`, JSON.stringify(project));
    }
  }, [project, slug, loadingFromDB]);

  /** Fills an empty project with the case-study template; keeps meta the user already entered. */
  function loadTemplate() {
    const template = createProjectTemplate();
    setProject((p) => ({
      ...p,
      title: p.title || template.title,
      category: p.category || template.category,
      year: p.year || template.year,
      description: p.description || template.description,
      coverImage: p.coverImage || template.coverImage,
      items: template.items,
    }));
  }

  async function handleSave() {
    // Always use the URL slug as the canonical ID — guards against stale localStorage data
    const dataToSave = { ...project, slug };
    setSaveStatus("saving");
    try {
      await saveProject(dataToSave);
      await system.save();
      setProject(dataToSave);
      setIsPublished(true);
      localStorage.setItem(`${STORAGE_KEY}_${slug}`, JSON.stringify(dataToSave));
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err) {
      console.error("Firestore save failed:", err);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  // Register save handler with the context so EditorNavControls can call it
  useEffect(() => {
    registerSave(handleSave);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, slug, system.revision]);

  if (loadingFromDB) {
    return (
      <div className="flex flex-col h-full bg-[var(--bg-1)]">
        <header className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-1)] select-none">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Link
              href="/admin/projects"
              className="inline-flex items-center h-10 gap-1.5 px-3 rounded-full text-sm font-medium text-[var(--text-p)] hover:bg-[var(--bg-4)] transition-colors duration-200 shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Projeler
            </Link>
            <div className="w-px h-4 bg-[var(--border)] shrink-0" />
            <div className="inline-flex items-center h-10 px-3.5 rounded-full border border-[var(--border)] bg-[var(--bg-1)] text-[var(--text-title)] text-sm font-medium select-none truncate max-w-[180px] lg:max-w-[260px]">
              {slug}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 shrink-0 flex-1">
            <ThemeToggle />
          </div>
        </header>
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <Spinner className="w-6 h-6 text-[var(--text-subtitle)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Single Header: back + title · editor switch · language / save / add / theme ── */}
      <header className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-1)] select-none">
        {/* Left: Back to projects + title pill */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Link
            href="/admin/projects"
            className="inline-flex items-center h-10 gap-1.5 px-3 rounded-full text-sm font-medium text-[var(--text-p)] hover:bg-[var(--bg-4)] transition-colors duration-200 shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Projeler
          </Link>
          <div className="w-px h-4 bg-[var(--border)] shrink-0" />
          <div
            className="inline-flex items-center h-10 px-3.5 rounded-full border border-[var(--border)] bg-[var(--bg-1)] text-[var(--text-title)] text-sm font-medium select-none truncate max-w-[180px] lg:max-w-[260px]"
            title={project.title || slug || "Başlıksız Proje"}
          >
            {project.title || slug || "Başlıksız Proje"}
          </div>
        </div>

        {/* Center: Mode switcher */}
        <div className="shrink-0 flex items-center justify-center">
          <Segmented
            options={MODES.map((m) => m.label)}
            value={MODES.find((m) => m.value === mode)?.label}
            onChange={(label) => changeMode(MODES.find((m) => m.label === label)?.value ?? "form")}
            size="md"
          />
        </div>

        {/* Right: Actions + ThemeToggle */}
        <div className="flex items-center justify-end gap-2 shrink-0 flex-1">
          <EditorNavControls />
          <PillButton size="md" onClick={() => setShowAddMenu(true)} startIcon={<PlusIcon />}>
            Ekle
          </PillButton>
          {isPublished && (
            <PillButton
              size="md"
              startIcon={
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M5 2H2a1 1 0 00-1 1v7a1 1 0 001 1h7a1 1 0 001-1V7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
                  <path d="M8 1h3m0 0v3m0-3L5.5 6.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
              onClick={() => window.open(`/projects/${slug}`, "_blank")}
              title="Yayın sayfasını yeni sekmede aç"
            >
              Yayında Görüntüle
            </PillButton>
          )}
          <div className="w-px h-4 bg-[var(--border)] shrink-0 mx-0.5" />
          <ThemeToggle />
        </div>
      </header>

      {/* ── Editor ── */}
      <div className="flex-1 min-h-0">
        {/* Live editor: drags start right away; block editor: press and hold. */}
        <DesignSystemProvider variables={system.variables} textStyles={system.textStyles} components={system.components}>
        <ProjectDndProvider items={project.items} onItemsChange={actions.setItems} activation={mode === "live" ? "press" : "hold"}>
          {mode === "form" ? (
            <FormEditor
              project={project}
              lang={editLang}
              slug={slug}
              companies={companies}
              actions={actions}
              onLoadTemplate={loadTemplate}
              onJsonChange={(p) => setProject({ ...p, items: normalizeItems(Array.isArray(p.items) ? p.items : []) })}
            />
          ) : (
            <LiveEditor
              project={project}
              lang={editLang}
              slug={slug}
              companies={companies}
              actions={actions}
              system={system}
              onLoadTemplate={loadTemplate}
            />
          )}
        </ProjectDndProvider>
        </DesignSystemProvider>
      </div>

      {showAddMenu && (
        <AddMenu
          onAddSection={() => actions.addSection()}
          onAddBlock={(type, extras) => actions.addBlockToEnd(type, extras)}
          onAddDivider={() => actions.addDivider()}
          onClose={() => setShowAddMenu(false)}
        />
      )}
    </div>
  );
}
