"use client";

export function DividerBlock() {
  return (
    <div className="flex flex-col gap-2 py-1">
      <span className="text-xs font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">
        Bölücü
      </span>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-[var(--border)]" />
        <span className="text-xs text-[var(--text-subtitle)] select-none">——</span>
        <div className="flex-1 h-px bg-[var(--border)]" />
      </div>
    </div>
  );
}
