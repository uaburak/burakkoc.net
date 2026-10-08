"use client";

/**
 * EditorNavControls — top-nav language switcher + save button.
 *
 * Communicates with AdminEditorClient via EditorContext so both
 * components share the same editLang / saveStatus state without
 * prop-drilling through the server-component page boundary.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Segmented } from "@/components/Segmented";
import { PillButton } from "@/components/Button";

// ── Context ───────────────────────────────────────────────────────────────────

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface EditorCtx {
  editLang: "tr" | "en";
  setEditLang: (l: "tr" | "en") => void;
  saveStatus: SaveStatus;
  setSaveStatus: (s: SaveStatus) => void;
  triggerSave: (() => Promise<void>) | null;
  registerSave: (fn: () => Promise<void>) => void;
}

const EditorContext = createContext<EditorCtx>({
  editLang: "tr",
  setEditLang: () => {},
  saveStatus: "idle",
  setSaveStatus: () => {},
  triggerSave: null,
  registerSave: () => {},
});

export function useEditorContext() {
  return useContext(EditorContext);
}

// ── Provider (wrap at the page level) ────────────────────────────────────────

export function EditorProvider({ children }: { children: ReactNode }) {
  const [editLang, setEditLang] = useState<"tr" | "en">("tr");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [triggerSave, setTriggerSave] = useState<(() => Promise<void>) | null>(null);

  const registerSave = useCallback((fn: () => Promise<void>) => {
    setTriggerSave(() => fn);
  }, []);

  return (
    <EditorContext.Provider value={{ editLang, setEditLang, saveStatus, setSaveStatus, triggerSave, registerSave }}>
      {children}
    </EditorContext.Provider>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function SaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 2h8l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.25" />
      <path d="M5 2v4h6V2M5 9h6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function SpinIcon() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="8 16" strokeLinecap="round"/>
    </svg>
  );
}
function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 4v4M7 10h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.25"/>
    </svg>
  );
}

// ── Nav controls (rendered in the top nav) ───────────────────────────────────

export function EditorNavControls() {
  const { editLang, setEditLang, saveStatus, triggerSave } = useEditorContext();

  async function handleSave() {
    if (triggerSave) await triggerSave();
  }

  // Determine save button variant & label
  const isSaving = saveStatus === "saving";
  const isSaved  = saveStatus === "saved";
  const isError  = saveStatus === "error";

  const saveIcon = isSaving ? <SpinIcon /> : isSaved ? <CheckIcon /> : isError ? <ErrorIcon /> : <SaveIcon />;
  const saveLabel = isSaving ? "Kaydediliyor…" : isSaved ? "Kaydedildi" : isError ? "Hata!" : "Kaydet";
  const saveVariant: "default" | "filled" | "ghost" = isSaved ? "filled" : "default";

  return (
    <div className="flex items-center gap-2">
      {/* ── Language switcher using shared Segmented sm=32px ── */}
      <Segmented
        options={["TR", "EN"]}
        value={editLang.toUpperCase()}
        onChange={(v) => setEditLang(v.toLowerCase() as "tr" | "en")}
        size="md"
      />

      {/* ── Save button using shared PillButton sm=32px ── */}
      <PillButton
        size="md"
        variant={saveVariant}
        startIcon={saveIcon}
        onClick={handleSave}
        disabled={isSaving}
        className={
          isSaved
            ? "border-green-300/60 bg-green-50/10 text-green-500 hover:border-green-300/60"
            : isError
            ? "border-red-300/60 text-red-500 hover:border-red-300/60"
            : undefined
        }
      >
        {saveLabel}
      </PillButton>
    </div>
  );
}
