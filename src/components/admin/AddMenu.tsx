"use client";

import { useEffect, useState } from "react";
import { Block, BlockType, ListStyle } from "@/types/project";
import { cn } from "@/lib/utils";
import { BackIcon, BlockTypeList, XIcon } from "@/components/admin/blockCatalog";

// ── Global Add Menu (two-level: Bölüm / Blok / Divider) ──────────────────────

type AddStep = "root" | "block" | "listStyle";

export function AddMenu({
  onAddSection, onAddBlock, onAddDivider, onClose,
}: {
  onAddSection: () => void;
  onAddBlock: (type: BlockType, extras?: Partial<Block>) => void;
  onAddDivider: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<AddStep>("root");
  const [visible, setVisible] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} aria-hidden />
      <div
        style={{ position: "fixed", left: "50%", top: "50%", transform: "translate(-50%, -50%)", zIndex: 9999 }}
        className={cn("transition-all duration-200 origin-center", visible ? "opacity-100 scale-100" : "opacity-0 scale-95")}
      >
        <div className="w-72 rounded-2xl border border-[var(--border)] bg-[var(--bg-2)] shadow-xl overflow-hidden">
          <div
            className="flex transition-transform duration-300 ease-in-out"
            style={{ width: "300%", transform: step === "listStyle" ? "translateX(-66.666%)" : step === "block" ? "translateX(-33.333%)" : "translateX(0%)" }}
          >
            {/* ── Step 1: Root ── */}
            <div className="w-1/3 flex-shrink-0 flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <span className="text-xs font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">Ekle</span>
                <button onClick={onClose} className="flex items-center justify-center w-5 h-5 rounded text-[var(--text-subtitle)] hover:text-[var(--text-title)] transition-colors cursor-pointer"><XIcon /></button>
              </div>
              <div className="p-3 grid grid-cols-3 gap-2">
                {/* Bölüm */}
                <button
                  onClick={() => { onAddSection(); onClose(); }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-1)] hover:bg-[var(--bg-4)] hover:border-[var(--border-hover)] transition-all duration-150 cursor-pointer text-center group"
                >
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] text-[var(--text-subtitle)] group-hover:text-[var(--text-title)] transition-colors duration-150">
                    <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
                      <rect x="1.5" y="1.5" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M5 6h8M5 9h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="text-xs font-medium text-[var(--text-title)]">Bölüm</span>
                </button>

                {/* Blok */}
                <button
                  onClick={() => setStep("block")}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-1)] hover:bg-[var(--bg-4)] hover:border-[var(--border-hover)] transition-all duration-150 cursor-pointer text-center group"
                >
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] text-[var(--text-subtitle)] group-hover:text-[var(--text-title)] transition-colors duration-150">
                    <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
                      <rect x="1.5" y="3.5" width="15" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M9 7v4M7 9h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="text-xs font-medium text-[var(--text-title)]">Blok</span>
                </button>

                {/* Divider — top-level page item */}
                <button
                  onClick={() => { onAddDivider(); onClose(); }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-1)] hover:bg-[var(--bg-4)] hover:border-[var(--border-hover)] transition-all duration-150 cursor-pointer text-center group"
                >
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] text-[var(--text-subtitle)] group-hover:text-[var(--text-title)] transition-colors duration-150">
                    <svg width="15" height="15" viewBox="0 0 18 18" fill="none">
                      <path d="M2 9h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="text-xs font-medium text-[var(--text-title)]">Divider</span>
                </button>
              </div>
            </div>

            {/* ── Step 2: Block types ── */}
            <div className="w-1/3 flex-shrink-0 flex flex-col">
              <div className="flex items-center gap-2 px-3 py-3 border-b border-[var(--border)]">
                <button onClick={() => setStep("root")}
                  className="flex items-center justify-center w-6 h-6 rounded-lg border border-transparent text-[var(--text-subtitle)] hover:border-[var(--border-hover)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
                ><BackIcon /></button>
                <span className="flex-1 text-xs font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">Blok Tipi</span>
                <button onClick={onClose} className="flex items-center justify-center w-5 h-5 rounded text-[var(--text-subtitle)] hover:text-[var(--text-title)] transition-colors cursor-pointer"><XIcon /></button>
              </div>
              <BlockTypeList onPick={(type) => { onAddBlock(type); onClose(); }} onPickList={() => setStep("listStyle")} />
            </div>

            {/* ── Step 3: List style ── */}
            <div className="w-1/3 flex-shrink-0 flex flex-col">
              <div className="flex items-center gap-2 px-3 py-3 border-b border-[var(--border)]">
                <button onClick={() => setStep("block")}
                  className="flex items-center justify-center w-6 h-6 rounded-lg border border-transparent text-[var(--text-subtitle)] hover:border-[var(--border-hover)] hover:text-[var(--text-title)] hover:bg-[var(--bg-4)] transition-colors cursor-pointer"
                ><BackIcon /></button>
                <span className="flex-1 text-xs font-medium uppercase tracking-widest text-[var(--text-subtitle)] select-none">Liste Tipi</span>
                <button onClick={onClose} className="flex items-center justify-center w-5 h-5 rounded text-[var(--text-subtitle)] hover:text-[var(--text-title)] transition-colors cursor-pointer"><XIcon /></button>
              </div>
              <div className="p-1.5 flex flex-col gap-0.5">
                {(["bullet", "numbered", "check", "dash"] as ListStyle[]).map((ls) => {
                  const labels: Record<ListStyle, [string, string]> = {
                    bullet:   ["•",  "Bullet"],
                    numbered: ["1.", "Numaralı"],
                    check:    ["☑",  "Checklist"],
                    dash:     ["—",  "Dash"],
                  };
                  const [sym, lbl] = labels[ls];
                  return (
                    <button key={ls} onClick={() => { onAddBlock("list", { listStyle: ls }); onClose(); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors duration-150 hover:bg-[var(--bg-4)] group cursor-pointer"
                    >
                      <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--bg-3)] text-[var(--text-subtitle)] group-hover:text-[var(--text-title)] transition-colors duration-150 text-sm font-medium">{sym}</span>
                      <span className="text-sm font-medium text-[var(--text-title)]">{lbl}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
