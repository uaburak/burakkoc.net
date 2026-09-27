"use client";

import { ProjectTheme } from "@/types/project";
import { cn } from "@/lib/utils";
import { Input } from "@/components/Input";
import { PillButton } from "@/components/Button";
import { Segmented } from "@/components/Segmented";

/**
 * Per-project theme: corner radius and colors. Empty values mean "use the
 * site default" — nothing is stored for them.
 */

const RADIUS_OPTIONS: { value?: string; label: string }[] = [
  { value: undefined, label: "Varsayılan" },
  { value: "0px", label: "0" },
  { value: "8px", label: "8" },
  { value: "16px", label: "16" },
  { value: "24px", label: "24" },
  { value: "32px", label: "32" },
  { value: "9999px", label: "Pill" },
];

const ACCENT_PRESETS = ["#1a1a1a", "#2f6bff", "#ff5722", "#10b981", "#8b5cf6", "#f43f5e", "#eab308", "#06b6d4"];

const HEX = /^#[0-9a-f]{6}$/i;

/** Drops empty keys; an empty theme is removed entirely. */
function cleanTheme(theme: ProjectTheme): ProjectTheme | undefined {
  const entries = Object.entries(theme).filter(([, v]) => typeof v === "string" && v.trim() !== "");
  return entries.length ? (Object.fromEntries(entries) as ProjectTheme) : undefined;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="px-1 text-[13px] leading-5 text-[var(--text-subtitle)] select-none">{children}</span>;
}

function ColorField({ label, value, onChange, presets }: {
  label: string;
  value?: string;
  onChange: (value: string | undefined) => void;
  presets?: string[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      {presets && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          {presets.map((color) => (
            <button
              key={color}
              type="button"
              title={color}
              aria-label={`${label}: ${color}`}
              onClick={() => onChange(color)}
              className={cn(
                "w-6 h-6 rounded-full border border-[var(--border-hover)] transition-transform duration-150 cursor-pointer hover:scale-110",
                value?.toLowerCase() === color && "ring-2 ring-[var(--text-title)] ring-offset-2 ring-offset-[var(--bg-4)]"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      )}
      <Input
        type="text"
        bgContext="block"
        size="md"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        placeholder="Varsayılan"
        className="tabular-nums"
        startContent={
          // The swatch doubles as the native color picker.
          <label
            className="relative block w-5 h-5 rounded-full border border-[var(--border-hover)] overflow-hidden cursor-pointer"
            style={{ backgroundColor: value || "transparent" }}
            title="Renk seç"
          >
            <input
              type="color"
              value={value && HEX.test(value) ? value : "#000000"}
              onChange={(e) => onChange(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label={`${label} seç`}
            />
          </label>
        }
        endContent={
          value ? (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              aria-label={`${label}: varsayılana dön`}
              title="Varsayılana dön"
              className="flex items-center justify-center w-6 h-6 rounded-full text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          ) : undefined
        }
      />
    </div>
  );
}

export function ProjectThemeFields({ theme, onChange, header = true }: {
  theme?: ProjectTheme;
  onChange: (theme: ProjectTheme | undefined) => void;
  /** Title + reset row; off when the host already shows them (live editor panel) */
  header?: boolean;
}) {
  const current = theme ?? {};
  const set = (key: keyof ProjectTheme, value: string | undefined) => onChange(cleanTheme({ ...current, [key]: value }));
  const radiusLabel = RADIUS_OPTIONS.find((o) => o.value === current.radius)?.label ?? "Varsayılan";

  return (
    <div className="flex flex-col gap-3 p-[12px] rounded-[18px] border border-[var(--border)] bg-[var(--bg-4)]">
      {header && (
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center px-[6px] text-[16px] font-medium text-[var(--text-title)] select-none">Tema</span>
          {theme && (
            <PillButton size="sm" bgContext="block" onClick={() => onChange(undefined)}>
              Varsayılana dön
            </PillButton>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <FieldLabel>Köşe yuvarlaklığı</FieldLabel>
        <Segmented
          options={RADIUS_OPTIONS.map((o) => o.label)}
          value={radiusLabel}
          onChange={(label) => set("radius", RADIUS_OPTIONS.find((o) => o.label === label)?.value)}
          size="sm"
          className="self-start"
        />
      </div>

      <ColorField label="Vurgu rengi" value={current.accentColor} onChange={(v) => set("accentColor", v)} presets={ACCENT_PRESETS} />
      <ColorField label="Sayfa arka planı" value={current.bgColor} onChange={(v) => set("bgColor", v)} />
      <ColorField label="Kart arka planı" value={current.cardBgColor} onChange={(v) => set("cardBgColor", v)} />
      <ColorField label="Başlık rengi" value={current.textColor} onChange={(v) => set("textColor", v)} />

      <p className="px-1 text-[12px] leading-5 text-[var(--text-subtitle)]">
        Vurgu rengi grafik çubuklarında, not ikonlarında, işaretli listelerde ve bağlantılarda görünür.
        Arka plan ve başlık renkleri açık ve koyu temada aynı kalır.
      </p>
    </div>
  );
}
