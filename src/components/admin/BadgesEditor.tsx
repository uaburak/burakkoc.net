"use client";

import { useRef, useState, useEffect } from "react";
import { BadgeIconType, BadgeItem, BadgePosition, SegmentedSecondTab } from "@/types/project";

// ── Constants ─────────────────────────────────────────────────────────────────

const BADGE_DEFS: { type: BadgeIconType; label: string; icon: React.ReactNode }[] = [
  { type: "link",      label: "Link",      icon: <ILink /> },
  { type: "search",    label: "Arama",     icon: <ISearch /> },
  { type: "play",      label: "Oynat",     icon: <IPlay /> },
  { type: "external",  label: "Dışarı",    icon: <IExternal /> },
  { type: "gear",      label: "Ayar",      icon: <IGear /> },
  { type: "segmented", label: "Segmented", icon: <ISegmented /> },
];

const POSITIONS: { value: BadgePosition; label: string }[] = [
  { value: "top-left",     label: "Sol Üst"  },
  { value: "top-right",    label: "Sağ Üst"  },
  { value: "bottom-left",  label: "Sol Alt"  },
  { value: "bottom-right", label: "Sağ Alt"  },
];

const SECOND_TAB_TYPES = [
  { value: "image", label: "Resim" },
  { value: "video", label: "Video" },
  { value: "code",  label: "Kod"   },
  { value: "text",  label: "Metin" },
] as const;

function hasExtra(icon: BadgeIconType) {
  return icon === "link" || icon === "external" || icon === "segmented";
}

function uid() { return Math.random().toString(36).slice(2, 8); }
function getBadgeMeta(icon: BadgeIconType) { return BADGE_DEFS.find((d) => d.type === icon); }

function moveArray<T>(arr: T[], from: number, to: number): T[] {
  const result = [...arr];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function ILink() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M7 9C7.33 9.39 7.74 9.71 8.21 9.93c.47.21.98.32 1.5.32s1.03-.11 1.5-.32c.47-.22.88-.54 1.21-.93L13.92 7.5C14.56 6.83 14.91 5.94 14.9 5.02 14.89 4.1 14.52 3.22 13.87 2.57 13.22 1.92 12.34 1.55 11.42 1.54c-.92-.01-1.81.34-2.48.98L7.97 3.49" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M9 7C8.67 6.61 8.26 6.29 7.79 6.07 7.32 5.86 6.81 5.75 6.29 5.75c-.52 0-1.03.11-1.5.32-.47.22-.88.54-1.21.93L2.08 8.5C1.44 9.17 1.09 10.06 1.1 10.98c.01.92.38 1.8 1.03 2.45.65.65 1.53 1.02 2.45 1.03.92.01 1.81-.34 2.48-.98L8.03 12.51" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
function ISearch() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  );
}
function IPlay() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M4.5 3L13.5 8L4.5 13V3Z" fill="currentColor" stroke="currentColor" strokeWidth="0.5"/>
    </svg>
  );
}
function IExternal() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M9 3H13V7M13 3L7 9M6 4H4C3.45 4 3 4.45 3 5V12C3 12.55 3.45 13 4 13H11c.55 0 1-.45 1-1V10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IGear() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M8 2v1.2M8 12.8V14M2 8h1.2M12.8 8H14M3.52 3.52l.85.85M11.63 11.63l.85.85M3.52 12.48l.85-.85M11.63 4.37l.85-.85" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}
function ISegmented() {
  return (
    <svg width="15" height="11" viewBox="0 0 18 12" fill="none">
      <rect x="0.5" y="0.5" width="17" height="11" rx="5.5" stroke="currentColor" strokeWidth="1.2"/>
      <rect x="1" y="1" width="7" height="10" rx="5" fill="currentColor" opacity="0.15"/>
      <text x="4.5" y="8.5" fontSize="5.5" fill="currentColor" textAnchor="middle" fontWeight="500">A</text>
      <text x="13.5" y="8.5" fontSize="5.5" fill="currentColor" textAnchor="middle" opacity="0.5" fontWeight="500">B</text>
    </svg>
  );
}
function ITrash() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M1.5 3h9M4.5 3V2h3v1M3.5 3l.5 7h4l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/** Six-dot grip */
function IGrip() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
      <circle cx="3"  cy="3"  r="1.2" fill="currentColor"/>
      <circle cx="3"  cy="7"  r="1.2" fill="currentColor"/>
      <circle cx="3"  cy="11" r="1.2" fill="currentColor"/>
      <circle cx="7"  cy="3"  r="1.2" fill="currentColor"/>
      <circle cx="7"  cy="7"  r="1.2" fill="currentColor"/>
      <circle cx="7"  cy="11" r="1.2" fill="currentColor"/>
    </svg>
  );
}

// ── Position corner icon ──────────────────────────────────────────────────────

function PosIcon({ pos, active }: { pos: BadgePosition; active: boolean }) {
  const dots: Record<BadgePosition, [number, number]> = {
    "top-left":     [3.5, 3.5],
    "top-right":    [10.5, 3.5],
    "bottom-left":  [3.5, 10.5],
    "bottom-right": [10.5, 10.5],
  };
  const [cx, cy] = dots[pos];
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="1" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1" opacity={active ? "0.7" : "0.2"} />
      <circle cx={cx} cy={cy} r="1.8" fill="currentColor" opacity={active ? "1" : "0.2"} />
    </svg>
  );
}

// ── Segmented config ──────────────────────────────────────────────────────────

function SegmentedConfig({ badge, onChange }: { badge: BadgeItem; onChange: (u: Partial<BadgeItem>) => void }) {
  const tab2 = badge.tab2 ?? { type: "image" as const };
  function update2(u: Partial<SegmentedSecondTab>) { onChange({ tab2: { ...tab2, ...u } as SegmentedSecondTab }); }

  const fc = "w-full rounded-lg border border-[var(--border)] bg-[var(--bg-1)] px-2.5 py-1.5 text-xs text-[var(--text-p)] placeholder:text-[var(--text-subtitle)] focus:outline-none focus:border-[var(--border-hover)] transition-colors duration-150";
  const chip = (a: boolean) => `px-2 py-1 rounded-md text-[10px] font-medium border transition-colors cursor-pointer ${a ? "border-[var(--text-title)] bg-[var(--bg-4)] text-[var(--text-title)]" : "border-[var(--border)] text-[var(--text-subtitle)] hover:text-[var(--text-p)]"}`;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={badge.tab1Label ?? ""} onChange={(e) => onChange({ tab1Label: e.target.value })} placeholder="Sekme 1 adı" className={fc} />
        <input type="text" value={badge.tab2Label ?? ""} onChange={(e) => onChange({ tab2Label: e.target.value })} placeholder="Sekme 2 adı" className={fc} />
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {SECOND_TAB_TYPES.map(({ value, label }) => (
          <button key={value} onClick={() => update2({ type: value })} className={chip(tab2.type === value)}>{label}</button>
        ))}
      </div>
      {(tab2.type === "image" || tab2.type === "video") && (
        <input type="url" value={tab2.src ?? ""} onChange={(e) => update2({ src: e.target.value })} placeholder="URL" className={fc} />
      )}
      {tab2.type === "code" && (
        <textarea value={tab2.content ?? ""} onChange={(e) => update2({ content: e.target.value })} rows={3} placeholder="// kod…" className={`${fc} resize-none font-mono`} />
      )}
      {tab2.type === "text" && (
        <textarea value={tab2.content ?? ""} onChange={(e) => update2({ content: e.target.value })} rows={2} placeholder="Metin…" className={`${fc} resize-none`} />
      )}
    </div>
  );
}

// ── Badge Row ─────────────────────────────────────────────────────────────────

interface BadgeRowProps {
  badge: BadgeItem;
  isDragging: boolean;   // this row is being dragged
  isOver: boolean;       // this row is the drop target
  onChange: (u: Partial<BadgeItem>) => void;
  onDelete: () => void;
  onGripPointerDown: (e: React.PointerEvent) => void;
  rowRef: (el: HTMLDivElement | null) => void;
}

function BadgeRow({ badge, isDragging, isOver, onChange, onDelete, onGripPointerDown, rowRef }: BadgeRowProps) {
  const [open, setOpen] = useState(false);
  const meta = getBadgeMeta(badge.icon);
  const canExpand = hasExtra(badge.icon);

  const fc = "w-full rounded-lg border border-[var(--border)] bg-[var(--bg-1)] px-2.5 py-1.5 text-xs text-[var(--text-p)] placeholder:text-[var(--text-subtitle)] focus:outline-none focus:border-[var(--border-hover)] transition-colors duration-150";

  return (
    <div
      ref={rowRef}
      className={[
        "rounded-xl border overflow-hidden transition-all duration-100 select-none",
        isDragging ? "opacity-40 scale-[0.98] border-[var(--border)] bg-[var(--bg-2)]" :
        isOver     ? "border-[var(--border-hover)] bg-[var(--bg-4)] shadow-sm" :
                     "border-[var(--border)] bg-[var(--bg-2)]",
      ].join(" ")}
    >
      {/* ── Main row ── */}
      <div
        className={`flex items-center gap-2 px-2 py-2 ${canExpand ? "cursor-pointer hover:bg-[var(--bg-4)] transition-colors duration-100" : ""}`}
        onClick={() => canExpand && setOpen((v) => !v)}
      >
        {/* Grip — pointer-event capture here */}
        <span
          className="flex-shrink-0 text-[var(--text-subtitle)] opacity-30 hover:opacity-70 transition-opacity duration-100 cursor-grab active:cursor-grabbing touch-none px-0.5 py-1"
          onPointerDown={(e) => { e.stopPropagation(); onGripPointerDown(e); }}
          onClick={(e) => e.stopPropagation()}
        >
          <IGrip />
        </span>

        {/* Icon + label */}
        <span className="text-[var(--text-subtitle)] flex-shrink-0 flex items-center w-3.5">{meta?.icon}</span>
        <span className="flex-1 text-xs font-medium text-[var(--text-p)] truncate min-w-0">{meta?.label}</span>

        {/* 4 position icons */}
        <div className="flex items-center gap-0.5 shrink-0">
          {POSITIONS.map((p) => (
            <button
              key={p.value}
              onClick={(e) => { e.stopPropagation(); onChange({ position: p.value }); }}
              title={p.label}
              className={`flex items-center justify-center w-6 h-6 rounded-md transition-colors duration-100 cursor-pointer ${badge.position === p.value ? "text-[var(--text-title)]" : "text-[var(--text-subtitle)] hover:text-[var(--text-p)]"}`}
            >
              <PosIcon pos={p.value} active={badge.position === p.value} />
            </button>
          ))}
        </div>

        {/* Delete */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Kaldır"
          className="flex items-center justify-center w-6 h-6 rounded-md border border-transparent text-[var(--text-subtitle)] hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-colors duration-100 cursor-pointer flex-shrink-0"
        >
          <ITrash />
        </button>
      </div>

      {/* ── Accordion body ── */}
      {canExpand && open && (
        <div className="px-3 pb-3 pt-2.5 border-t border-[var(--border)] bg-[var(--bg-1)] flex flex-col gap-2.5">
          {(badge.icon === "link" || badge.icon === "external") && (
            <input
              type="url"
              value={badge.href ?? ""}
              onChange={(e) => onChange({ href: e.target.value })}
              placeholder="https://…"
              className={fc}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {badge.icon === "segmented" && <SegmentedConfig badge={badge} onChange={onChange} />}
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

interface BadgesEditorProps {
  badges: BadgeItem[];
  onChange: (badges: BadgeItem[]) => void;
}

export function BadgesEditor({ badges, onChange }: BadgesEditorProps) {
  const [showPicker, setShowPicker] = useState(false);

  // ── Drag state ──
  const [dragSource, setDragSource] = useState<number | null>(null);
  const [dragOver,   setDragOver]   = useState<number | null>(null);

  // Refs — needed inside event listeners added to document
  const dragSourceRef = useRef<number | null>(null);
  const dragOverRef   = useRef<number | null>(null);
  const badgesRef     = useRef(badges);
  const rowRefs       = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => { badgesRef.current = badges; }, [badges]);

  // Find the closest badge row index to a given clientY
  function findClosestIndex(clientY: number): number {
    let closest = 0;
    let closestDist = Infinity;
    rowRefs.current.forEach((el, i) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mid  = rect.top + rect.height / 2;
      const dist = Math.abs(clientY - mid);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    });
    return closest;
  }

  function handleGripPointerDown(e: React.PointerEvent, sourceIndex: number) {
    e.preventDefault();

    dragSourceRef.current = sourceIndex;
    dragOverRef.current   = sourceIndex;
    setDragSource(sourceIndex);
    setDragOver(sourceIndex);

    // Prevent text selection globally while dragging
    document.body.style.userSelect = "none";

    function onPointerMove(ev: PointerEvent) {
      const over = findClosestIndex(ev.clientY);
      if (over !== dragOverRef.current) {
        dragOverRef.current = over;
        setDragOver(over);
      }
    }

    function onPointerUp() {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup",   onPointerUp);
      document.body.style.userSelect = "";

      const from = dragSourceRef.current;
      const to   = dragOverRef.current;

      setDragSource(null);
      setDragOver(null);
      dragSourceRef.current = null;
      dragOverRef.current   = null;

      if (from !== null && to !== null && from !== to) {
        onChange(moveArray(badgesRef.current, from, to));
      }
    }

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup",   onPointerUp);
  }

  // ── Helpers ──
  function addBadge(type: BadgeIconType) {
    const newBadge: BadgeItem = {
      id: uid(), icon: type, position: "top-right",
      ...(type === "segmented" ? { tab1Label: "", tab2Label: "", tab2: { type: "image" as const } } : {}),
    };
    onChange([...badges, newBadge]);
    setShowPicker(false);
  }

  function updateBadge(id: string, updates: Partial<BadgeItem>) {
    onChange(badges.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  }

  function deleteBadge(id: string) {
    onChange(badges.filter((b) => b.id !== id));
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">Badges</span>
        <button
          onClick={() => setShowPicker((v) => !v)}
          className="text-[10px] font-medium px-2 py-1 rounded-lg border border-dashed border-[var(--border-hover)] text-[var(--text-subtitle)] hover:text-[var(--text-p)] hover:border-[var(--text-subtitle)] transition-colors cursor-pointer"
        >
          {showPicker ? "Kapat" : "+ Ekle"}
        </button>
      </div>

      {/* Type picker */}
      {showPicker && (
        <div className="grid grid-cols-3 gap-1.5 p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-2)]">
          {BADGE_DEFS.map(({ type, label, icon }) => (
            <button key={type} onClick={() => addBadge(type)}
              className="flex flex-col items-center gap-1 p-2 rounded-lg border border-transparent hover:border-[var(--border)] hover:bg-[var(--bg-4)] transition-all duration-100 cursor-pointer group"
            >
              <span className="text-[var(--text-subtitle)] group-hover:text-[var(--text-title)] transition-colors duration-100">{icon}</span>
              <span className="text-[10px] text-[var(--text-subtitle)] group-hover:text-[var(--text-p)] transition-colors duration-100">{label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Badge list */}
      {badges.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {badges.map((badge, i) => (
            <BadgeRow
              key={badge.id}
              badge={badge}
              isDragging={dragSource === i}
              isOver={dragOver === i && dragSource !== null && dragSource !== i}
              rowRef={(el) => { rowRefs.current[i] = el; }}
              onChange={(updates) => updateBadge(badge.id, updates)}
              onDelete={() => deleteBadge(badge.id)}
              onGripPointerDown={(e) => handleGripPointerDown(e, i)}
            />
          ))}
        </div>
      )}

      {badges.length === 0 && !showPicker && (
        <p className="text-[10px] text-[var(--text-subtitle)] opacity-40 italic select-none text-center py-1">
          Badge eklenmedi
        </p>
      )}
    </div>
  );
}
