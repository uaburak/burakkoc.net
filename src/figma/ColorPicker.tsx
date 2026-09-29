"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DesignVariable, VariableValue } from "@/types/design";
import { cn } from "@/lib/utils";
import { fi } from "@/components/admin/figmaIcons";
import { boundValue, splitName, type ThemeMode } from "@/components/project/designVariables";
import { IconButton, NumericInput, Select, Tab, TextInput, selectAllOnClick } from "./ui";
import { PAINT_LABEL, type GradientStop, type Paint } from "./model";

/**
 * Figma's colour picker (UI3): Custom — the colour's square (saturation
 * across, brightness down), the hue and the alpha sliders, the eyedropper,
 * the hex and the opacity, the colours already on this page; Libraries —
 * the site's colour variables. Floats beside the design panel.
 */

type Hsv = { h: number; s: number; v: number };

function hexToHsv(hex: string): Hsv {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const to = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function ColorPicker({ color, opacity, anchor, variables, byId, mode, pageColors, onChange, onVariable, onClose, paint, onPaint, onUpload, onCreateVariable }: {
  color: string;
  opacity: number;
  /** The fill being edited, when it may become a gradient or an image */
  paint?: Paint;
  onPaint?: (paint: Paint) => void;
  /** An image chosen from the disk: its URL once uploaded */
  onUpload?: (file: File) => Promise<string>;
  /** "+": the colour kept as a new colour variable */
  onCreateVariable?: (hex: string) => void;
  /** Where it opens: beside the panel, at this top */
  anchor: { top: number; right: number };
  variables: DesignVariable[];
  byId: Map<string, DesignVariable>;
  mode: ThemeMode;
  /** The colours used on this page (Figma's "On this page") */
  pageColors: string[];
  onChange: (hex: string, opacity: number) => void;
  onVariable?: (value: VariableValue) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"custom" | "libraries">("custom");
  const kind: NonNullable<Paint["type"]> = paint?.type ?? "solid";
  const [stop, setStop] = useState(0);
  const [uploading, setUploading] = useState(false);
  const stops = paint?.gradient?.stops ?? [];
  const current = kind === "gradient" && stops[stop] ? stops[stop].color : color;
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(current));
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  // The colour changed elsewhere (a variable, the hex): the square follows — not while it is being dragged here.
  const own = useRef(current);
  useEffect(() => {
    if (current.toLowerCase() !== own.current.toLowerCase()) {
      own.current = current;
      setHsv(hexToHsv(current));
    }
  }, [current]);
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!ref.current?.contains(t) && !t.closest("[data-picker-anchor]")) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("pointerdown", onDown); window.removeEventListener("keydown", onKey, true); };
  }, [onClose]);

  const setStops = (next: GradientStop[]) => onPaint?.({ ...paint!, type: "gradient", gradient: { angle: paint?.gradient?.angle ?? 90, stops: next } });
  const set = (next: Hsv) => {
    setHsv(next);
    const hex = hsvToHex(next);
    own.current = hex;
    if (kind === "gradient" && stops[stop]) return setStops(stops.map((st, i) => (i === stop ? { ...st, color: hex } : st)));
    onChange(hex, opacity);
  };
  const setKind = (next: NonNullable<Paint["type"]>) => {
    if (!paint || !onPaint || next === kind) return;
    if (next === "solid") return onPaint({ ...paint, type: undefined, gradient: undefined, image: undefined });
    if (next === "gradient") return onPaint({ ...paint, type: "gradient", gradient: paint.gradient ?? { angle: 90, stops: [{ color, position: 0 }, { color: "#ffffff", position: 100 }] } });
    onPaint({ ...paint, type: "image", image: paint.image ?? { url: "", fit: "fill" } });
  };
  const chooseImage = () => {
    if (!onUpload) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const url = await onUpload(file);
        onPaint?.({ ...paint!, type: "image", image: { url, fit: paint?.image?.fit ?? "fill" } });
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };
  const drag = (e: React.PointerEvent, update: (x: number, y: number) => void) => {
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    const at = (ev: { clientX: number; clientY: number }) => update(Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)));
    at(e);
    const move = (ev: PointerEvent) => at(ev);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const eyedropper = typeof window !== "undefined" && "EyeDropper" in window;
  const pick = async () => {
    try {
      const Dropper = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
      const { sRGBHex } = await new Dropper().open();
      set(hexToHsv(sRGBHex));
    } catch { /* cancelled */ }
  };
  const colorVars = useMemo(() => variables.filter((v) => v.kind === "color"), [variables]);
  const top = Math.max(8, Math.min(anchor.top, window.innerHeight - 520));
  const left = Math.max(8, anchor.right - 240 - 8);

  return (
    <div ref={ref} role="dialog" aria-label="Renk" className="fixed z-50 flex w-[240px] flex-col rounded-[13px] bg-[var(--f-bg)] shadow-[0_0_0.5px_rgba(0,0,0,0.3),0_10px_16px_rgba(0,0,0,0.2)] text-[11px] leading-4 text-[var(--f-text)]" style={{ top, left }} onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between h-10 px-2 border-b border-[var(--f-border)]">
        <div className="flex items-center gap-1">
          <Tab label="Özel" active={tab === "custom"} onClick={() => setTab("custom")} />
          <Tab label="Kütüphaneler" active={tab === "libraries"} onClick={() => setTab("libraries")} />
        </div>
        <div className="flex items-center gap-1">
          {onCreateVariable && <IconButton label="Renk değişkeni oluştur" icon={fi("plus.small")} onClick={() => { onCreateVariable(hsvToHex(hsv)); onClose(); }} />}
          <IconButton label="Kapat" icon={fi("close.small")} onClick={onClose} />
        </div>
      </div>
      {tab === "custom" ? (
        <div className="flex flex-col gap-2 p-2">
          <div className="flex items-center gap-1 px-1">
            <IconButton label="Düz" icon={fi("24.fill.solid.small")} active={kind === "solid"} onClick={() => setKind("solid")} />
            {kind !== "solid" && <span className="ml-1 text-[var(--f-text-secondary)]">{PAINT_LABEL[kind]}</span>}
            <IconButton label="Gradyan" icon={fi("24.gradient.linear.small")} active={kind === "gradient"} disabled={!onPaint} onClick={() => setKind("gradient")} />
            <IconButton label="Görsel" icon={fi("24.fill.image.small")} active={kind === "image"} disabled={!onPaint} onClick={() => setKind("image")} />
          </div>
          {kind === "gradient" && paint?.gradient && (
            <div className="flex flex-col gap-2">
              <div className="relative h-4 rounded-[3px]" style={{ background: `linear-gradient(to right, ${[...stops].sort((a, b) => a.position - b.position).map((st) => `${st.color} ${st.position}%`).join(", ")})` }} onDoubleClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); const at = Math.round(((e.clientX - r.left) / r.width) * 100); setStops([...stops, { color: hsvToHex(hsv), position: at }]); setStop(stops.length); }}>
                {stops.map((st, i) => (
                  <button key={i} type="button" aria-label={`Durak ${i + 1}`} onPointerDown={(e) => { e.stopPropagation(); setStop(i); drag(e as unknown as React.PointerEvent, () => {}); const bar = e.currentTarget.parentElement!.getBoundingClientRect(); const move = (ev: PointerEvent) => setStops(stops.map((x, j) => (j === i ? { ...x, position: Math.round(Math.min(100, Math.max(0, ((ev.clientX - bar.left) / bar.width) * 100))) } : x))); const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); }} className={cn("absolute top-1/2 w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 shadow-[0_0_0_1px_rgba(0,0,0,0.3)] cursor-pointer", i === stop ? "border-[var(--f-border-selected)]" : "border-white")} style={{ left: `${st.position}%`, background: st.color }} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <NumericInput label="Açı" prefix={<span className="flex w-6 justify-center text-[var(--f-text-secondary)]">{fi("24.rotation", 16)}</span>} value={paint.gradient.angle} min={0} max={360} unit="°" onChange={(angle) => onPaint?.({ ...paint, gradient: { ...paint.gradient!, angle } })} />
                <NumericInput label="Durak konumu" prefix={<span className="flex w-6 justify-center text-[var(--f-text-secondary)]">%</span>} value={stops[stop]?.position ?? 0} min={0} max={100} onChange={(position) => setStops(stops.map((x, j) => (j === stop ? { ...x, position } : x)))} />
                <IconButton label="Durağı kaldır" icon={fi("minus.small")} disabled={stops.length <= 2} onClick={() => { setStops(stops.filter((_, j) => j !== stop)); setStop(0); }} />
              </div>
            </div>
          )}
          {kind === "image" ? (
            <div className="flex flex-col gap-2">
              <div className="w-full h-[120px] rounded-[5px] bg-[var(--f-bg-secondary)] bg-center bg-no-repeat" style={{ backgroundImage: paint?.image?.url ? `url("${paint.image.url}")` : undefined, backgroundSize: paint?.image?.fit === "fit" ? "contain" : paint?.image?.fit === "tile" ? "auto" : "cover", backgroundRepeat: paint?.image?.fit === "tile" ? "repeat" : "no-repeat" }} />
              <div className="flex items-center gap-2">
                <Select label="Sığdırma" value={paint?.image?.fit ?? "fill"} options={[{ value: "fill", label: "Doldur" }, { value: "fit", label: "Sığdır" }, { value: "tile", label: "Döşe" }]} onChange={(fit) => onPaint?.({ ...paint!, image: { url: paint?.image?.url ?? "", fit: fit as "fill" | "fit" | "tile" } })} />
                <button type="button" onClick={chooseImage} disabled={!onUpload || uploading} className="flex h-6 shrink-0 items-center px-2 rounded-[5px] bg-[var(--f-bg-secondary)] text-[var(--f-text)] hover:bg-[var(--f-bg-hover)] cursor-pointer disabled:opacity-50">{uploading ? "Yükleniyor…" : "Görsel seç…"}</button>
              </div>
              <TextInput label="Görsel adresi" value={paint?.image?.url ?? ""} placeholder="https://…" onCommit={(url) => onPaint?.({ ...paint!, image: { url: url.trim(), fit: paint?.image?.fit ?? "fill" } })} />
            </div>
          ) : (
          <div className="relative w-full h-[184px] rounded-[5px] overflow-hidden cursor-crosshair" style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }} onPointerDown={(e) => drag(e, (x, y) => set({ ...hsv, s: x, v: 1 - y }))}>
            <span className="pointer-events-none absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hsvToHex(hsv) }} />
          </div>
          )}
          {kind !== "image" && (
          <div className="flex items-center gap-2">
            <IconButton label="Damlalık" icon={fi("24.eyedropper.small")} onClick={pick} disabled={!eyedropper} />
            <div className="flex flex-1 flex-col gap-2">
              <div className="relative h-3 rounded-full cursor-pointer" style={{ background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }} onPointerDown={(e) => drag(e, (x) => set({ ...hsv, h: x * 360 }))}>
                <span className="pointer-events-none absolute top-1/2 w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]" style={{ left: `${(hsv.h / 360) * 100}%`, background: hueColor }} />
              </div>
              <div className="relative h-3 rounded-full cursor-pointer" style={{ background: `linear-gradient(to right, transparent, ${hsvToHex(hsv)}), repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 0 0 / 8px 8px` }} onPointerDown={(e) => drag(e, (x) => onChange(hsvToHex(hsv), Math.round(x * 100)))}>
                <span className="pointer-events-none absolute top-1/2 w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)] bg-[var(--f-bg)]" style={{ left: `${opacity}%` }} />
              </div>
            </div>
          </div>
          )}
          {kind !== "image" && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 h-6 px-2 rounded-[5px] bg-[var(--f-bg-secondary)] text-[var(--f-text)]">Hex {fi("16.chevron.down")}</span>
            <div className="flex flex-1 items-center h-6 rounded-[5px] bg-[var(--f-bg-secondary)]">
              <input
                aria-label="Hex"
                value={hexDraft ?? hsvToHex(hsv).replace("#", "").toUpperCase()}
                {...selectAllOnClick}
                onChange={(e) => setHexDraft(e.target.value)}
                onBlur={(e) => { const d = e.currentTarget.value.replace("#", ""); if (/^[0-9a-f]{6}$/i.test(d)) set(hexToHsv(`#${d}`)); setHexDraft(null); }}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
                className="min-w-0 flex-1 h-full pl-2 bg-transparent outline-none uppercase text-[var(--f-text)]"
              />
              <span className="flex w-[53px] h-full items-center border-l border-[var(--f-bg)]">
                <NumericInput label="Opaklık" prefix={<span className="w-[7px]" />} value={opacity} min={0} max={100} unit="%" onChange={(o) => onChange(hsvToHex(hsv), o)} className="bg-transparent border-0 hover:border-0 rounded-none" />
              </span>
            </div>
          </div>
          )}
          <div className="mt-1 pt-2 border-t border-[var(--f-border)]">
            <div className="flex items-center justify-between h-6 px-1 text-[var(--f-text)]">
              <span>Bu sayfada</span>
              <span className="text-[var(--f-icon-secondary)]">{fi("16.chevron.down")}</span>
            </div>
            <div className="grid grid-cols-8 gap-1 px-1 pt-1 pb-1">
              {pageColors.map((c) => (
                <button key={c} type="button" title={c} aria-label={c} onClick={() => set(hexToHsv(c))} className="w-5 h-5 rounded-[3px] border border-[var(--f-border-translucent)] cursor-pointer" style={{ background: c }} />
              ))}
              {pageColors.length === 0 && <span className="col-span-8 py-1 text-[var(--f-text-secondary)]">Henüz renk yok.</span>}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col py-1 max-h-[420px] overflow-y-auto">
          {colorVars.length === 0 && <p className="px-3 py-2 text-[var(--f-text-secondary)]">Renk değişkeni yok.</p>}
          {colorVars.map((v) => {
            const value = String(boundValue(v.light, mode, byId) ?? "#000000");
            return (
              <button key={v.id} type="button" onClick={() => { onVariable?.({ alias: v.id }); onClose(); }} className="flex items-center gap-2 h-8 px-3 text-left hover:bg-[var(--f-bg-hover)] cursor-pointer" disabled={!onVariable}>
                <span className={cn("w-4 h-4 shrink-0 rounded-full border border-[var(--f-border-translucent)]")} style={{ background: value }} />
                <span className="min-w-0 flex-1 truncate text-[var(--f-text)]">{v.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Every colour of its own used in these nodes (fills and strokes), each once. */
export function colorsIn(nodes: readonly import("./model").SceneNode[]): string[] {
  const out = new Set<string>();
  const visit = (list: readonly import("./model").SceneNode[]) => {
    for (const n of list) {
      for (const p of [...(n.fills ?? []), ...(n.type !== "text" ? n.strokes ?? [] : [])]) if (!("alias" in p.color) && typeof p.color.value === "string") out.add(p.color.value.toLowerCase());
      if ("children" in n) visit(n.children);
    }
  };
  visit(nodes);
  return [...out];
}

export { hexToHsv, hsvToHex, splitName };
