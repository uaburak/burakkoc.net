"use client";

import { createContext, useContext } from "react";
import type { DesignVariable, VariableValue } from "@/types/design";

/**
 * The site's design variables (see DesignVariable): the starting ones — the
 * site's own tokens from globals.css — and the ones added in the editor, as
 * CSS custom properties inside `[data-design-scope]` (the project page, the
 * editor's canvas).
 */

const color = (id: string, name: string, token: string, light: string, dark: string): DesignVariable => ({
  id,
  name,
  kind: "color",
  token,
  light: { value: light },
  dark: { value: dark },
});

/** The site's own tokens (globals.css), as the first variables — same values, so nothing changes until they are edited. */
export const STARTING_VARIABLES: DesignVariable[] = [
  color("bg-1", "Arka plan/1", "--bg-1", "#ffffff", "#000000"),
  color("bg-2", "Arka plan/2", "--bg-2", "#fefefe", "#0a0a0a"),
  color("bg-3", "Arka plan/3", "--bg-3", "#fcfcfc", "#0f0f0f"),
  color("bg-4", "Arka plan/4", "--bg-4", "#f2f2f2", "#1e1e1e"),
  color("bg-5", "Arka plan/5", "--bg-5", "#e4e4e4", "#343434"),
  color("bg-code", "Arka plan/Kod", "--bg-code", "#fcfcfc", "#0f0f0f"),
  color("text-title", "Metin/Başlık", "--text-title", "#1a1a1a", "#f2f2f2"),
  color("text-p", "Metin/Paragraf", "--text-p", "#2a2a2a", "#e5e5e5"),
  color("text-subtitle", "Metin/Alt başlık", "--text-subtitle", "#757575", "#a0a0a0"),
  color("border", "Kenar/Varsayılan", "--border", "#f2f2f2", "#1e1e1e"),
  color("border-hover", "Kenar/Aktif", "--border-hover", "#e4e4e4", "#343434"),
];

/** The site's variables: the starting ones — as stored, when changed — in their place, then the added ones. */
export function withStartingVariables(stored: DesignVariable[]): DesignVariable[] {
  const byId = new Map(stored.map((v) => [v.id, v]));
  const starting = new Set(STARTING_VARIABLES.map((v) => v.id));
  return [...STARTING_VARIABLES.map((v) => byId.get(v.id) ?? v), ...stored.filter((v) => !starting.has(v.id))];
}

export type ThemeMode = "light" | "dark";

/** A variable's own value in a theme (a colour's light one when it has no dark one). */
export function modeValue(variable: DesignVariable, mode: ThemeMode): VariableValue {
  return mode === "dark" && variable.kind === "color" ? variable.dark ?? variable.light : variable.light;
}

/** A variable's value in a theme, following aliases to the value itself — null for a broken or circular alias. */
export function resolvedValue(variable: DesignVariable, mode: ThemeMode, byId: Map<string, DesignVariable>, seen = new Set<string>()): string | number | null {
  const own = modeValue(variable, mode);
  if (!("alias" in own)) return own.value;
  if (seen.has(variable.id)) return null;
  seen.add(variable.id);
  const target = byId.get(own.alias);
  return target ? resolvedValue(target, mode, byId, seen) : null;
}

/** Can `variable` point at `target`: the same kind, and no alias of `target` leading back to `variable`? */
export function canAlias(variable: DesignVariable, target: DesignVariable, byId: Map<string, DesignVariable>): boolean {
  if (target.kind !== variable.kind || target.id === variable.id) return false;
  const reaches = (v: DesignVariable, seen: Set<string>): boolean => {
    if (v.id === variable.id) return true;
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return [v.light, v.dark].some((value) => {
      const next = value && "alias" in value ? byId.get(value.alias) : undefined;
      return next ? reaches(next, seen) : false;
    });
  };
  return !reaches(target, new Set());
}

/** A variable's CSS custom property: its token, or one of its own. */
export function cssName(variable: DesignVariable) {
  return variable.token ?? `--v-${variable.id}`;
}

/** A value as CSS: its own (px for sizes), or the variable it points at. */
function cssValue(value: VariableValue, variable: DesignVariable, byId: Map<string, DesignVariable>): string | null {
  if ("alias" in value) {
    const target = byId.get(value.alias);
    return target ? `var(${cssName(target)})` : null;
  }
  if (variable.kind === "number") return `${Number(value.value) || 0}px`;
  return String(value.value);
}

/** The variables as CSS: their values inside the scope, colours' dark values under the dark theme. */
export function variablesCss(variables: DesignVariable[]): string {
  const byId = new Map(variables.map((v) => [v.id, v]));
  const light: string[] = [];
  const dark: string[] = [];
  for (const v of variables) {
    const l = cssValue(v.light, v, byId);
    if (l) light.push(`${cssName(v)}: ${l};`);
    const d = v.kind === "color" && v.dark ? cssValue(v.dark, v, byId) : null;
    if (d) dark.push(`${cssName(v)}: ${d};`);
  }
  return `[data-design-scope] { ${light.join(" ")} }\n[data-theme="dark"] [data-design-scope] { ${dark.join(" ")} }`;
}

/** The site's variables — the editor's working copy while editing. */
export const DesignVariablesContext = createContext<DesignVariable[]>(STARTING_VARIABLES);

export const useDesignVariables = () => useContext(DesignVariablesContext);

/** Puts the variables on the page: render it inside the element carrying `data-design-scope`. */
export function DesignVariablesStyle() {
  const variables = useDesignVariables();
  return <style>{variablesCss(variables)}</style>;
}
