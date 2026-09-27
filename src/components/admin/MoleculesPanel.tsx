"use client";

import type { DesignMolecule, DesignVariable } from "@/types/design";
import { cn } from "@/lib/utils";
import { cssValue } from "@/components/project/designVariables";
import { splitName } from "@/components/admin/VariablesPanel";

/**
 * The live editor's "Moleküller" tab — the site's molecules (see
 * DesignMolecule), as Figma's local components: grouped by their names'
 * paths, each with a sample of its frame (its background and corners), its
 * name and its atoms; a click opens it in the inspector. A new one is a copy
 * of another (the inspector's "Çoğalt").
 */

/** A molecule's frame in small: its background, its corners at a quarter. */
function MoleculeSample({ molecule, byId }: { molecule: DesignMolecule; byId: Map<string, DesignVariable> }) {
  const background = molecule.background ? cssValue(molecule.background, "color", byId) : null;
  const radius = molecule.radius ? cssValue(molecule.radius, "number", byId) : null;
  return (
    // A design scope of its own: the site's variables reach it outside the canvas too.
    <span data-design-scope="" className="flex items-center justify-center shrink-0 w-5">
      <span
        className="block w-5 h-3.5 border border-[var(--border-hover)]"
        style={{ backgroundColor: background ?? "transparent", borderRadius: radius ? `calc(${radius} / 4)` : undefined }}
      />
    </span>
  );
}

export function MoleculesPanel({ molecules, variables, selectedId, onSelect }: {
  molecules: DesignMolecule[];
  variables: DesignVariable[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const byId = new Map(variables.map((v) => [v.id, v]));
  // Groups in the order they first appear.
  const groups = new Map<string, DesignMolecule[]>();
  for (const m of molecules) {
    const [group] = splitName(m.name);
    groups.set(group, [...(groups.get(group) ?? []), m]);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="px-3 text-[11px] leading-4 text-[var(--text-subtitle)]">
        Atomların birlikte çalıştığı küçük gruplar: bir çerçeve ve içindeki atomlar. Bir molekülü değiştirince onu kullanan her bileşen birlikte değişir. Yenisi için birini seçip çoğalt.
      </p>
      {[...groups].map(([group, list]) => (
        <div key={group || "—"} className="flex flex-col gap-px">
          {group && <p className="h-7 flex items-center px-3 text-[11px] font-medium text-[var(--text-subtitle)] select-none">{group}</p>}
          {list.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelect(m.id)}
              className={cn(
                "flex items-center gap-2 h-8 px-3 rounded-[8px] text-left text-[12px] cursor-pointer transition-colors",
                selectedId === m.id ? "bg-[var(--bg-4)]" : "hover:bg-[color-mix(in_srgb,var(--bg-4)_60%,transparent)]"
              )}
            >
              <MoleculeSample molecule={m} byId={byId} />
              <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-title)]">{splitName(m.name)[1] || "Adsız"}</span>
              <span className="shrink-0 max-w-[50%] truncate text-[11px] text-[var(--text-subtitle)]">{m.slots.map((slot) => slot.name).join(" + ")}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
