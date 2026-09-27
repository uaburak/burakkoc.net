"use client";

import type { ReactNode } from "react";
import type { DesignVariable, VariableKind } from "@/types/design";
import { cn } from "@/lib/utils";
import { resolvedValue } from "@/components/project/designVariables";
import { FigmaIcon } from "@/components/admin/figmaIcons";

/**
 * The live editor's "Değişkenler" tab — the site's design variables, as
 * Figma's local variables: grouped by their names' paths ("Metin/Başlık" sits
 * in Metin), each with its swatch or kind and its value; a click opens it in
 * the inspector. New ones are added from the top.
 */

/** Figma's number variable, for numbers and weights alike. */
const KIND_ICON: Record<Exclude<VariableKind, "color">, ReactNode> = {
  number: <FigmaIcon name="16.number" />,
  weight: <FigmaIcon name="16.number" />,
};

const ADD: { kind: VariableKind; label: string }[] = [
  { kind: "color", label: "Renk" },
  { kind: "number", label: "Sayı" },
  { kind: "weight", label: "Kalınlık" },
];

/** A name's group ("Metin/Başlık" → "Metin") and its own part ("Başlık"). */
export function splitName(name: string): [string, string] {
  const at = name.lastIndexOf("/");
  return at < 0 ? ["", name] : [name.slice(0, at), name.slice(at + 1)];
}

export function VariablesPanel({ variables, selectedId, onSelect, onAdd }: {
  variables: DesignVariable[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (kind: VariableKind) => void;
}) {
  const byId = new Map(variables.map((v) => [v.id, v]));
  // Groups in the order they first appear.
  const groups = new Map<string, DesignVariable[]>();
  for (const v of variables) {
    const [group] = splitName(v.name);
    groups.set(group, [...(groups.get(group) ?? []), v]);
  }

  return (
    <div className="flex flex-col gap-3">
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
          {list.map((v) => {
            const light = resolvedValue(v, "light", byId);
            const alias = "alias" in v.light ? byId.get(v.light.alias) : undefined;
            const shown = alias ? alias.name : v.kind === "number" ? `${light ?? "—"}` : String(light ?? "—");
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelect(v.id)}
                className={cn(
                  "flex items-center gap-2 h-8 px-3 rounded-[8px] text-left text-[12px] cursor-pointer transition-colors",
                  selectedId === v.id ? "bg-[var(--bg-4)]" : "hover:bg-[color-mix(in_srgb,var(--bg-4)_60%,transparent)]"
                )}
              >
                {v.kind === "color" ? (
                  <span className="block w-3.5 h-3.5 shrink-0 rounded-[3px] border border-[var(--border-hover)]" style={{ backgroundColor: typeof light === "string" ? light : "transparent" }} />
                ) : (
                  <span className="flex items-center justify-center w-3.5 h-3.5 shrink-0 text-[var(--text-subtitle)]"><span className="flex -m-px">{KIND_ICON[v.kind]}</span></span>
                )}
                <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-title)]">{splitName(v.name)[1] || "Adsız"}</span>
                <span className={cn("shrink-0 max-w-[45%] truncate text-[11px] tabular-nums", alias ? "text-[var(--edit-accent)]" : "text-[var(--text-subtitle)]")}>{shown}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
