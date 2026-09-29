"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ProjectData } from "@/types/project";
import { useEditorContext } from "@/components/admin/EditorNavControls";
import { saveProject, loadProject } from "@/lib/firestore";
import { Spinner } from "@/components/icons";
import { normalizeItems } from "@/lib/projectLayout";
import { DesignSystemProvider } from "@/components/project/designSystem";
import { useDesignSystem } from "@/components/admin/useDesignSystem";
import { useUndo } from "@/components/admin/useUndo";
import { FigmaEditor } from "@/figma/FigmaEditor";
import { newDocument, upgradeDocument, type FigmaDocument } from "@/figma/model";

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

/** The project with its Figma file — a new one (its page frame named after it) when it has none yet. */
const withCanvas = (p: ProjectData): ProjectData => ({ ...p, canvas: p.canvas ? upgradeDocument(p.canvas) : newDocument(p.title || p.slug) });

// ── Main editor ───────────────────────────────────────────────────────────────

/**
 * The project's editor: Figma, for its page (see FigmaEditor). The project
 * is loaded from Firestore, edited in memory, written back only with
 * Kaydet — with the site's variables (useDesignSystem). Undo / redo keeps
 * the last 20 steps in memory.
 */
export function AdminEditorClient({ slug }: { slug: string }) {
  const [project, setProject] = useState<ProjectData>({ ...EMPTY_PROJECT, slug });
  const { setSaveStatus, registerSave } = useEditorContext();
  const [loadingFromDB, setLoadingFromDB] = useState(true);
  /** Whether this project exists in Firestore (i.e. has been published at least once) */
  const [isPublished, setIsPublished] = useState(false);
  const system = useDesignSystem();

  // ── Load from Firestore on mount — always enforce URL slug ──
  useEffect(() => {
    loadProject(slug)
      .then((data) => {
        if (data) {
          if (!Array.isArray(data.items)) data.items = [];
          const normalized = withCanvas({ ...data, slug });
          setProject(normalized);
          setIsPublished(true);
          localStorage.setItem(`${STORAGE_KEY}_${slug}`, JSON.stringify(normalized));
        } else {
          const draft = readDraft(slug);
          setProject((p) => withCanvas(draft ?? (p.slug !== slug ? { ...p, slug } : p)));
        }
      })
      .catch((err) => {
        console.warn("Firestore load failed, using local cache:", err);
        const draft = readDraft(slug);
        setProject((p) => withCanvas(draft ?? p));
      })
      .finally(() => setLoadingFromDB(false));
  }, [slug]);

  // ── Mirror to localStorage a moment after the last edit ──
  const latestProject = useRef<ProjectData | null>(null);
  useEffect(() => {
    latestProject.current = loadingFromDB ? null : project;
  }, [project, loadingFromDB]);
  useEffect(() => {
    if (loadingFromDB) return;
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(`${STORAGE_KEY}_${slug}`, JSON.stringify(project)); } catch { /* ignore */ }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [project, slug, loadingFromDB]);
  useEffect(() => () => {
    const last = latestProject.current;
    if (last) try { localStorage.setItem(`${STORAGE_KEY}_${slug}`, JSON.stringify(last)); } catch { /* ignore */ }
  }, [slug]);

  async function handleSave() {
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

  // ── Undo / redo (⌘Z, ⇧⌘Z): the last 20 steps, in memory only ──
  const { variables: storedVariables, textStyles: storedTextStyles, components: storedComponents, nodes: storedNodes } = system.stored;
  const edited = useMemo(
    () => ({ project, variables: storedVariables, textStyles: storedTextStyles, components: storedComponents, nodes: storedNodes }),
    [project, storedVariables, storedTextStyles, storedComponents, storedNodes]
  );
  const history = useUndo(
    edited,
    (step) => {
      setProject(step.project);
      system.restore({ variables: step.variables, textStyles: step.textStyles, components: step.components, nodes: step.nodes });
    },
    { ready: !loadingFromDB && system.loaded }
  );

  // Register the save handler once, the latest one behind it.
  const saveRef = useRef(handleSave);
  useEffect(() => {
    saveRef.current = handleSave;
  });
  useEffect(() => {
    registerSave(() => saveRef.current());
  }, [registerSave]);

  const doc = project.canvas ?? null;
  const onDoc = useCallback((update: (doc: FigmaDocument) => FigmaDocument) => {
    setProject((p) => {
      const current = p.canvas ?? newDocument(p.title || p.slug);
      const next = update(current);
      return next === p.canvas ? p : { ...p, canvas: next };
    });
  }, []);

  if (loadingFromDB || !doc) {
    return (
      <div className="flex flex-col h-full bg-[var(--bg-1)]">
        <header className="shrink-0 flex items-center justify-between gap-3 px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-1)] select-none">
          <Link href="/admin/projects" className="inline-flex items-center h-10 gap-1.5 px-3 rounded-full text-sm font-medium text-[var(--text-p)] hover:bg-[var(--bg-4)] transition-colors duration-200 shrink-0">
            Projeler
          </Link>
          <ThemeToggle />
        </header>
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <Spinner className="w-6 h-6 text-[var(--text-subtitle)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DesignSystemProvider variables={system.variables} textStyles={system.textStyles} components={system.components}>
        <FigmaEditor
          doc={doc}
          onDoc={onDoc}
          title={project.title}
          slug={slug}
          system={system}
          isPublished={isPublished}
          undo={history.undo}
          redo={history.redo}
        />
      </DesignSystemProvider>
    </div>
  );
}
