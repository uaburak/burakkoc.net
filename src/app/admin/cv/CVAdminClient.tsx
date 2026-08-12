"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Input } from "@/components/Input";
import { PillButton } from "@/components/Button";
import { Segmented } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useEditorContext, EditorNavControls } from "@/components/admin/EditorNavControls";
import { getCVData, saveCVData } from "@/lib/firestore";
import { uploadFile, coverStoragePath } from "@/lib/storage";
import { CVData } from "@/types/cv";
import { CVClient } from "@/app/cv/CVClient";
import { cn } from "@/lib/utils";
import { JsonEditor } from "@/components/admin/JsonEditor";
import { Spinner } from "@/components/icons";

function uid() {
  return "id-" + Math.random().toString(36).slice(2, 9);
}

const ICON_TYPES = [
  "figma",
  "illustrator",
  "photoshop",
  "ai",
  "indesign",
  "office",
  "aftereffect",
  "html",
  "css",
  "tailwind",
];

const SOURCE_MODES = ["URL", "Yükle"];

// ── Icons ─────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 3.333v9.334M3.333 8h9.334" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Pill label matching AdminEditorClient ──────────────────────────────────────
function PillLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-[6px] text-[16px] font-medium text-[var(--text-title)] select-none whitespace-nowrap">
      {children}
    </span>
  );
}

// ── Traffic light action dots matching AdminEditorClient ────────────────────────
function TrafficDots({
  onUp,
  onDown,
  onDelete,
}: {
  onUp?: () => void;
  onDown?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {onUp && (
        <button
          type="button"
          onClick={onUp}
          title="Yukarı taşı"
          data-traffic-color="#00e288"
          data-traffic-icon="up"
          className="w-3 h-3 rounded-full transition-opacity duration-150 cursor-pointer flex-shrink-0 hover:opacity-75"
          style={{ background: "#00e288" }}
        />
      )}
      {onDown && (
        <button
          type="button"
          onClick={onDown}
          title="Aşağı taşı"
          data-traffic-color="#e2d300"
          data-traffic-icon="down"
          className="w-3 h-3 rounded-full transition-opacity duration-150 cursor-pointer flex-shrink-0 hover:opacity-75"
          style={{ background: "#e2d300" }}
        />
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          title="Sil"
          data-traffic-color="#e20000"
          data-traffic-icon="trash"
          className="w-3 h-3 rounded-full transition-opacity duration-150 cursor-pointer flex-shrink-0 hover:opacity-75"
          style={{ background: "#e20000" }}
        />
      )}
    </div>
  );
}

// ── Auto-expanding Textarea without scrollbar ─────────────────────────────────

function AutoTextarea({
  value,
  onChange,
  placeholder,
  rows = 2,
  bgContext = "block",
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  bgContext?: "section" | "block";
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [value, autoResize]);

  return (
    <textarea
      ref={ref}
      rows={rows}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        autoResize();
      }}
      placeholder={placeholder}
      className={cn(
        "w-full resize-none overflow-hidden rounded-[18px] px-4 py-3 text-sm font-light leading-6 text-[var(--text-p)] placeholder:text-[var(--text-subtitle)] focus:outline-none focus:border-[var(--border-hover)] transition-all duration-150",
        bgContext === "section"
          ? "border border-[var(--border)] bg-[var(--bg-1)] hover:bg-[var(--bg-4)] hover:border-[var(--border-hover)]"
          : "border border-transparent bg-[var(--bg-1)] hover:bg-[var(--bg-1)] hover:border-[var(--border-hover)]"
      )}
    />
  );
}

// ── Reusable Media Upload Component ────────────────────────────────────────────

function MediaUploadField({
  value,
  onChange,
  folderSlug,
  accept = "image/*",
  placeholder = "Görsel URL — https://…",
}: {
  value: string;
  onChange: (url: string) => void;
  folderSlug: string;
  accept?: string;
  placeholder?: string;
}) {
  const [tab, setTab] = useState<"URL" | "Yükle">("URL");
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const handleFile = async (file: File) => {
    setProgress(0);
    try {
      const path = coverStoragePath(folderSlug, file);
      const url = await uploadFile(file, path, setProgress);
      onChange(url);
    } catch (err) {
      console.error("Upload failed:", err);
      alert("Dosya yüklenirken hata oluştu.");
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="flex items-center gap-[10px]">
      <Segmented
        options={SOURCE_MODES}
        value={tab}
        onChange={(v) => setTab(v as "URL" | "Yükle")}
        size="md"
      />
      {tab === "URL" ? (
        <Input
          type="url"
          bgContext="block"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          size="md"
          className="flex-1"
        />
      ) : (
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <PillButton
            size="md"
            bgContext="block"
            onClick={() => fileRef.current?.click()}
            startIcon={
              progress !== null ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="30 70" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              )
            }
          >
            {progress !== null ? `${progress}%` : "Dosya Seç"}
          </PillButton>
          {value && (
            <span className="text-xs text-[var(--text-subtitle)] truncate max-w-[200px]">
              {value.split("/").pop()?.split("?")[0]}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main CV Admin Client ───────────────────────────────────────────────────────

export function CVAdminClient() {
  const [cvData, setCvData] = useState<CVData | null>(null);
  const [loading, setLoading] = useState(true);

  const { saveStatus, setSaveStatus, registerSave } = useEditorContext();

  useEffect(() => {
    getCVData()
      .then((data) => {
        setCvData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load CV data:", err);
        setLoading(false);
      });
  }, []);

  const handleSave = useCallback(async () => {
    if (!cvData) return;
    setSaveStatus("saving");
    try {
      await saveCVData(cvData);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch (err) {
      console.error("Failed to save CV data:", err);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }, [cvData, setSaveStatus]);

  useEffect(() => {
    registerSave(handleSave);
  }, [handleSave, registerSave]);

  if (loading || !cvData) {
    return (
      <div className="min-h-screen w-full bg-[var(--bg-1)] flex items-center justify-center">
        <Spinner className="w-6 h-6 text-[var(--text-subtitle)]" />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[var(--bg-1)] transition-colors duration-200">
      {/* ── Top Nav (identical to Admin project editor) ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-[var(--border)] bg-[var(--bg-1)]">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center h-10 gap-1.5 px-3 rounded-full text-sm font-medium text-[var(--text-p)] hover:bg-[var(--bg-4)] transition-colors duration-200"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Admin
          </Link>
          <div className="w-px h-4 bg-[var(--border)]" />
          <span className="text-sm text-[var(--text-subtitle)] font-mono">/admin/cv</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </div>

      {/* ── Split Editor (fills remaining height) ── */}
      <div className="flex-1 min-h-0 flex h-full">
        {/* ── LEFT PANEL — Editor Form ── */}
        <div className="flex flex-col w-1/2 border-r border-[var(--border)] overflow-y-auto">
          {/* Sticky Editor Header */}
          <div className="sticky top-0 z-30 flex items-center justify-between px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-1)]/90 backdrop-blur-md">
            <div className="inline-flex items-center h-10 px-3.5 rounded-full border border-[var(--border)] bg-[var(--bg-1)] text-[var(--text-title)] text-sm font-medium select-none truncate max-w-[240px]">
              {cvData.name || "CV Yönetimi"}
            </div>
            <div className="flex items-center gap-2">
              <EditorNavControls />
            </div>
          </div>

          {/* Form Scroll Area */}
          <div className="flex flex-col gap-6 px-5 py-8">
            {/* ─── 01 Profil ─── */}
            <div className="flex flex-col gap-[10px] p-[18px] rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] transition-colors duration-200">
              <PillLabel>01 Profil</PillLabel>

              <div className="flex flex-col gap-[10px] p-[12px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-4)]">
                <PillLabel>Kişisel Bilgiler</PillLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Input
                    size="md"
                    bgContext="block"
                    placeholder="İsim Soyisim"
                    value={cvData.name}
                    onChange={(e) => setCvData({ ...cvData, name: e.target.value })}
                  />
                  <Input
                    size="md"
                    bgContext="block"
                    placeholder="Unvan / Rol"
                    value={cvData.role}
                    onChange={(e) => setCvData({ ...cvData, role: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-[10px] p-[12px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-4)]">
                <PillLabel>Profil Resmi</PillLabel>
                <MediaUploadField
                  value={cvData.profileImage}
                  onChange={(url) => setCvData({ ...cvData, profileImage: url })}
                  folderSlug="cv-profile"
                  accept="image/*"
                  placeholder="Profil resmi URL — https://…"
                />
              </div>

              <div className="flex flex-col gap-[10px] p-[12px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-4)]">
                <PillLabel>CV PDF Bağlantısı</PillLabel>
                <MediaUploadField
                  value={cvData.cvPdfUrl}
                  onChange={(url) => setCvData({ ...cvData, cvPdfUrl: url })}
                  folderSlug="cv-pdf"
                  accept=".pdf"
                  placeholder="CV PDF URL — /CV-EN.pdf"
                />
              </div>
            </div>

            {/* ─── 02 Hakkında ─── */}
            <div className="flex flex-col gap-[10px] p-[18px] rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] transition-colors duration-200">
              <div className="flex items-center justify-between">
                <PillLabel>02 Hakkında</PillLabel>
                <PillButton
                  size="md"
                  onClick={() =>
                    setCvData({
                      ...cvData,
                      aboutParagraphs: [...cvData.aboutParagraphs, ""],
                    })
                  }
                  startIcon={<PlusIcon />}
                >
                  Paragraf Ekle
                </PillButton>
              </div>

              <div className="flex flex-col gap-3">
                {cvData.aboutParagraphs.map((paragraph, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-[10px] p-[12px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-4)] transition-colors duration-150"
                  >
                    <div className="flex items-center justify-between">
                      <PillLabel>Paragraf {index + 1}</PillLabel>
                      <TrafficDots
                        onDelete={() => {
                          const next = cvData.aboutParagraphs.filter((_, i) => i !== index);
                          setCvData({ ...cvData, aboutParagraphs: next });
                        }}
                      />
                    </div>
                    <AutoTextarea
                      rows={3}
                      value={paragraph}
                      onChange={(val) => {
                        const next = [...cvData.aboutParagraphs];
                        next[index] = val;
                        setCvData({ ...cvData, aboutParagraphs: next });
                      }}
                      placeholder={`Paragraf ${index + 1} metni…`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ─── 03 Deneyimler ─── */}
            <div className="flex flex-col gap-[10px] p-[18px] rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] transition-colors duration-200">
              <div className="flex items-center justify-between">
                <PillLabel>03 Deneyimler</PillLabel>
                <PillButton
                  size="md"
                  onClick={() =>
                    setCvData({
                      ...cvData,
                      experience: [
                        {
                          id: uid(),
                          year: "2024 — Present",
                          company: "Yeni Şirket",
                          role: "Tasarımcı",
                          description: "",
                        },
                        ...cvData.experience,
                      ],
                    })
                  }
                  startIcon={<PlusIcon />}
                >
                  Deneyim Ekle
                </PillButton>
              </div>

              <div className="flex flex-col gap-3">
                {cvData.experience.map((exp, index) => (
                  <div
                    key={exp.id || index}
                    className="flex flex-col gap-[10px] p-[12px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-4)] transition-colors duration-150"
                  >
                    <div className="flex items-center justify-between">
                      <PillLabel>Deneyim {index + 1}</PillLabel>
                      <TrafficDots
                        onUp={
                          index > 0
                            ? () => {
                                const arr = [...cvData.experience];
                                const item = arr.splice(index, 1)[0];
                                arr.splice(index - 1, 0, item);
                                setCvData({ ...cvData, experience: arr });
                              }
                            : undefined
                        }
                        onDown={
                          index < cvData.experience.length - 1
                            ? () => {
                                const arr = [...cvData.experience];
                                const item = arr.splice(index, 1)[0];
                                arr.splice(index + 1, 0, item);
                                setCvData({ ...cvData, experience: arr });
                              }
                            : undefined
                        }
                        onDelete={() => {
                          const next = cvData.experience.filter((_, i) => i !== index);
                          setCvData({ ...cvData, experience: next });
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <Input
                        size="md"
                        bgContext="block"
                        placeholder="Tarih / Yıl (Jul 2024 — Present)"
                        value={exp.year}
                        onChange={(e) => {
                          const next = [...cvData.experience];
                          next[index].year = e.target.value;
                          setCvData({ ...cvData, experience: next });
                        }}
                      />
                      <Input
                        size="md"
                        bgContext="block"
                        placeholder="Şirket İsmi"
                        value={exp.company}
                        onChange={(e) => {
                          const next = [...cvData.experience];
                          next[index].company = e.target.value;
                          setCvData({ ...cvData, experience: next });
                        }}
                      />
                      <Input
                        size="md"
                        bgContext="block"
                        placeholder="Rol / Pozisyon"
                        value={exp.role}
                        onChange={(e) => {
                          const next = [...cvData.experience];
                          next[index].role = e.target.value;
                          setCvData({ ...cvData, experience: next });
                        }}
                      />
                    </div>

                    <AutoTextarea
                      rows={2}
                      value={exp.description}
                      onChange={(val) => {
                        const next = [...cvData.experience];
                        next[index].description = val;
                        setCvData({ ...cvData, experience: next });
                      }}
                      placeholder="Deneyim açıklaması…"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ─── 04 Eğitim ─── */}
            <div className="flex flex-col gap-[10px] p-[18px] rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] transition-colors duration-200">
              <div className="flex items-center justify-between">
                <PillLabel>04 Eğitim</PillLabel>
                <PillButton
                  size="md"
                  onClick={() =>
                    setCvData({
                      ...cvData,
                      education: [
                        {
                          id: uid(),
                          year: "2020 — 2024",
                          institution: "Üniversite İsmi",
                          degree: "Bölüm İsmi",
                          description: "",
                        },
                        ...cvData.education,
                      ],
                    })
                  }
                  startIcon={<PlusIcon />}
                >
                  Eğitim Ekle
                </PillButton>
              </div>

              <div className="flex flex-col gap-3">
                {cvData.education.map((edu, index) => (
                  <div
                    key={edu.id || index}
                    className="flex flex-col gap-[10px] p-[12px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-4)] transition-colors duration-150"
                  >
                    <div className="flex items-center justify-between">
                      <PillLabel>Eğitim {index + 1}</PillLabel>
                      <TrafficDots
                        onUp={
                          index > 0
                            ? () => {
                                const arr = [...cvData.education];
                                const item = arr.splice(index, 1)[0];
                                arr.splice(index - 1, 0, item);
                                setCvData({ ...cvData, education: arr });
                              }
                            : undefined
                        }
                        onDown={
                          index < cvData.education.length - 1
                            ? () => {
                                const arr = [...cvData.education];
                                const item = arr.splice(index, 1)[0];
                                arr.splice(index + 1, 0, item);
                                setCvData({ ...cvData, education: arr });
                              }
                            : undefined
                        }
                        onDelete={() => {
                          const next = cvData.education.filter((_, i) => i !== index);
                          setCvData({ ...cvData, education: next });
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <Input
                        size="md"
                        bgContext="block"
                        placeholder="Tarih / Yıl (2017 — 2019)"
                        value={edu.year}
                        onChange={(e) => {
                          const next = [...cvData.education];
                          next[index].year = e.target.value;
                          setCvData({ ...cvData, education: next });
                        }}
                      />
                      <Input
                        size="md"
                        bgContext="block"
                        placeholder="Okul / Kurum"
                        value={edu.institution}
                        onChange={(e) => {
                          const next = [...cvData.education];
                          next[index].institution = e.target.value;
                          setCvData({ ...cvData, education: next });
                        }}
                      />
                      <Input
                        size="md"
                        bgContext="block"
                        placeholder="Derece / Bölüm"
                        value={edu.degree}
                        onChange={(e) => {
                          const next = [...cvData.education];
                          next[index].degree = e.target.value;
                          setCvData({ ...cvData, education: next });
                        }}
                      />
                    </div>

                    <AutoTextarea
                      rows={2}
                      value={edu.description}
                      onChange={(val) => {
                        const next = [...cvData.education];
                        next[index].description = val;
                        setCvData({ ...cvData, education: next });
                      }}
                      placeholder="Eğitim açıklaması…"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ─── 05 Yetenekler ─── */}
            <div className="flex flex-col gap-[10px] p-[18px] rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] transition-colors duration-200">
              <div className="flex items-center justify-between">
                <PillLabel>05 Yetenekler</PillLabel>
                <PillButton
                  size="md"
                  onClick={() =>
                    setCvData({
                      ...cvData,
                      skillsList: [
                        ...cvData.skillsList,
                        { id: uid(), name: "Yeni Yetenek", level: 80, iconType: "figma" },
                      ],
                    })
                  }
                  startIcon={<PlusIcon />}
                >
                  Yetenek Ekle
                </PillButton>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cvData.skillsList.map((skill, index) => (
                  <div
                    key={skill.id || index}
                    className="flex flex-col gap-[10px] p-[12px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-4)] transition-colors duration-150 relative"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Input
                        size="sm"
                        bgContext="block"
                        type="text"
                        placeholder="Yetenek Adı"
                        value={skill.name}
                        onChange={(e) => {
                          const next = [...cvData.skillsList];
                          next[index].name = e.target.value;
                          setCvData({ ...cvData, skillsList: next });
                        }}
                        className="flex-1 font-medium"
                      />
                      <Select
                        size="sm"
                        bgContext="block"
                        options={ICON_TYPES}
                        value={skill.iconType}
                        onChange={(val) => {
                          const next = [...cvData.skillsList];
                          next[index].iconType = val;
                          setCvData({ ...cvData, skillsList: next });
                        }}
                        className="w-28"
                      />
                      <TrafficDots
                        onDelete={() => {
                          const next = cvData.skillsList.filter((_, i) => i !== index);
                          setCvData({ ...cvData, skillsList: next });
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={skill.level}
                        onChange={(e) => {
                          const next = [...cvData.skillsList];
                          next[index].level = Number(e.target.value);
                          setCvData({ ...cvData, skillsList: next });
                        }}
                        className="flex-1 accent-[var(--text-title)] cursor-pointer"
                      />
                      <span className="text-xs font-mono w-8 text-right text-[var(--text-subtitle)]">
                        {skill.level}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ─── 06 Hobiler ─── */}
            <div className="flex flex-col gap-[10px] p-[18px] rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] transition-colors duration-200">
              <div className="flex items-center justify-between">
                <PillLabel>06 Hobiler</PillLabel>
                <PillButton
                  size="md"
                  onClick={() =>
                    setCvData({
                      ...cvData,
                      hobbies: [...cvData.hobbies, "Yeni Hobi"],
                    })
                  }
                  startIcon={<PlusIcon />}
                >
                  Hobi Ekle
                </PillButton>
              </div>

              <div className="flex flex-wrap gap-2">
                {cvData.hobbies.map((hobby, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-transparent bg-[var(--bg-1)] hover:border-[var(--border-hover)] transition-all duration-150"
                  >
                    <input
                      type="text"
                      placeholder="Hobi metni…"
                      value={hobby}
                      onChange={(e) => {
                        const next = [...cvData.hobbies];
                        next[index] = e.target.value;
                        setCvData({ ...cvData, hobbies: next });
                      }}
                      className="bg-transparent text-sm font-light text-[var(--text-p)] focus:outline-none w-36 placeholder:text-[var(--text-subtitle)]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = cvData.hobbies.filter((_, i) => i !== index);
                        setCvData({ ...cvData, hobbies: next });
                      }}
                      title="Kaldır"
                      data-traffic-color="#e20000"
                      data-traffic-icon="trash"
                      className="w-3 h-3 rounded-full transition-opacity duration-150 cursor-pointer flex-shrink-0 hover:opacity-75"
                      style={{ background: "#e20000" }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ─── 07 İletişim ─── */}
            <div className="flex flex-col gap-[10px] p-[18px] rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] transition-colors duration-200">
              <div className="flex items-center justify-between">
                <PillLabel>07 İletişim</PillLabel>
                <PillButton
                  size="md"
                  onClick={() =>
                    setCvData({
                      ...cvData,
                      contact: [
                        ...cvData.contact,
                        { id: uid(), label: "Sosyal Medya", value: "/kullanici", href: "https://" },
                      ],
                    })
                  }
                  startIcon={<PlusIcon />}
                >
                  İletişim Ekle
                </PillButton>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cvData.contact.map((item, index) => (
                  <div
                    key={item.id || index}
                    className="flex flex-col gap-[10px] p-[12px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-4)] transition-colors duration-150 relative"
                  >
                    <div className="flex items-center justify-between">
                      <PillLabel>Bağlantı {index + 1}</PillLabel>
                      <TrafficDots
                        onDelete={() => {
                          const next = cvData.contact.filter((_, i) => i !== index);
                          setCvData({ ...cvData, contact: next });
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <Input
                        size="md"
                        bgContext="block"
                        placeholder="Etiket (ör: Email)"
                        value={item.label}
                        onChange={(e) => {
                          const next = [...cvData.contact];
                          next[index].label = e.target.value;
                          setCvData({ ...cvData, contact: next });
                        }}
                      />
                      <Input
                        size="md"
                        bgContext="block"
                        placeholder="Görünen Değer"
                        value={item.value}
                        onChange={(e) => {
                          const next = [...cvData.contact];
                          next[index].value = e.target.value;
                          setCvData({ ...cvData, contact: next });
                        }}
                      />
                    </div>
                    <Input
                      size="md"
                      bgContext="block"
                      placeholder="Bağlantı (href — https://…)"
                      value={item.href}
                      onChange={(e) => {
                        const next = [...cvData.contact];
                        next[index].href = e.target.value;
                        setCvData({ ...cvData, contact: next });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Editable JSON Output */}
            <JsonEditor value={cvData} onChange={setCvData} />
          </div>
        </div>

        {/* ── RIGHT PANEL — Live Preview ── */}
        <div className="flex flex-col w-1/2 overflow-y-auto bg-[var(--bg-1)] border-l border-[var(--border)]">
          {/* Sticky Preview Header */}
          <div className="sticky top-0 z-30 flex items-center justify-between px-5 py-3 border-b border-[var(--border)] bg-[var(--bg-1)]/90 backdrop-blur-md">
            <div className="inline-flex items-center h-10 px-3.5 rounded-full border border-[var(--border)] bg-[var(--bg-1)] text-[var(--text-title)] text-sm font-medium select-none">
              Canlı görünüm
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/cv"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-2)] text-xs font-medium text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-colors"
              >
                Sayfaya Git
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M7 2h3v3M10 2L5.5 6.5M5 3H3C2.45 3 2 3.45 2 4v5c0 .55.45 1 1 1h5c.55 0 1-.45 1-1V7"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </a>
            </div>
          </div>

          {/* Live CV Page Preview */}
          <div className="relative w-full">
            <CVClient previewData={cvData} isPreview={true} />
          </div>
        </div>
      </div>
    </div>
  );
}
