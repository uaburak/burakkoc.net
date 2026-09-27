"use client";

import type { AtomKind, DesignAtom, DesignVariable } from "@/types/design";
import { cn } from "@/lib/utils";
import { boundValue } from "@/components/project/designVariables";
import { splitName } from "@/components/admin/VariablesPanel";

/**
 * The live editor's "Atomlar" tab — the site's atoms (see DesignAtom), as
 * Figma's text styles: grouped by their names' paths, each with a sample in
 * its look, its name and its size / line height; a click opens it in the
 * inspector. New ones are added from the top.
 */

/** "Ag" in an atom's look — its weight and colour, at one size so the lists stay even. */
export function AtomSample({ atomId, className }: { atomId: string; className?: string }) {
  return (
    // A design scope of its own: the site's variables and the atom's rule reach it outside the canvas too.
    <span data-design-scope="" className={cn("flex items-center justify-center shrink-0 w-5 select-none", className)}>
      <span data-atom={atomId} style={{ fontSize: 13, lineHeight: "16px" }}>Ag</span>
    </span>
  );
}

/** An atom's size over its line height, as Figma writes a text style's: "14 / 20". */
export function atomMetrics(atom: DesignAtom, byId: Map<string, DesignVariable>) {
  const size = atom.fontSize ? boundValue(atom.fontSize, "light", byId) : null;
  const line = atom.lineHeight ? boundValue(atom.lineHeight, "light", byId) : null;
  return `${size ?? "—"} / ${line ?? "—"}`;
}

const ADD: { kind: AtomKind; label: string }[] = [{ kind: "text", label: "Metin" }];

export function AtomsPanel({ atoms, variables, selectedId, onSelect, onAdd }: {
  atoms: DesignAtom[];
  variables: DesignVariable[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (kind: AtomKind) => void;
}) {
  const byId = new Map(variables.map((v) => [v.id, v]));
  // Groups in the order they first appear.
  const groups = new Map<string, DesignAtom[]>();
  for (const a of atoms) {
    const [group] = splitName(a.name);
    groups.set(group, [...(groups.get(group) ?? []), a]);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="px-3 text-[11px] leading-4 text-[var(--text-subtitle)]">
        Sitenin en küçük parçaları. Her atom kendi tipografisini taşır; onu kullanan her metin birlikte değişir.
      </p>
      <div className="flex items-center gap-1 px-2">
        <span className="mr-auto text-[11px] text-[var(--text-subtitle)] select-none">Ekle</span>
        {ADD.map((a) => (
          <button
            key={a.kind}
            type="button"
            onClick={() => onAdd(a.kind)}
            className="h-6 px-2 rounded-[6px] text-[11px] font-medium text-[var(--text-title)] bg-[var(--bg-4)] hover:bg-[var(--bg-5)] transition-colors cursor-pointer"
          >
            + {a.label}
          </button>
        ))}
      </div>
      {[...groups].map(([group, list]) => (
        <div key={group || "—"} className="flex flex-col gap-px">
          {group && <p className="h-7 flex items-center px-3 text-[11px] font-medium text-[var(--text-subtitle)] select-none">{group}</p>}
          {list.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelect(a.id)}
              className={cn(
                "flex items-center gap-2 h-8 px-3 rounded-[8px] text-left text-[12px] cursor-pointer transition-colors",
                selectedId === a.id ? "bg-[var(--bg-4)]" : "hover:bg-[color-mix(in_srgb,var(--bg-4)_60%,transparent)]"
              )}
            >
              <AtomSample atomId={a.id} className="-ml-1" />
              <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-title)]">{splitName(a.name)[1] || "Adsız"}</span>
              <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-subtitle)]">{atomMetrics(a, byId)}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
