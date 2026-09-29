"use client";

import { useEffect, useMemo, useState } from "react";
import type { CanvasNode, DesignComponent, DesignVariable, TextStyle, VariableKind } from "@/types/design";
import { loadCanvasNodes, loadDesignComponents, loadDesignVariables, loadTextStyles, saveCanvasNodes, saveDesignComponents, saveDesignVariables, saveTextStyles } from "@/lib/firestore";
import { STARTING_VARIABLES, withStartingVariables } from "@/components/project/designVariables";
import { STARTING_TEXT_STYLES, newTextStyle, withStartingTextStyles } from "@/components/project/textStyles";
import { STARTING_COMPONENTS, copyComponent, isStartingComponent, withStartingComponents } from "@/components/project/components";
import { uid } from "@/components/admin/blockCatalog";

/**
 * The site's design system in the editor — its variables, text styles and
 * components: loaded once, edited here (every page changes with them) and
 * saved with the project, only the parts that changed.
 */
export interface DesignSystem {
  /** All of the variables, the starting ones included (see DesignVariable) */
  variables: DesignVariable[];
  /** One of the starting variables: it can only go back to its value, not be deleted */
  isStartingVariable: (id: string) => boolean;
  setVariable: (variable: DesignVariable) => void;
  /** Adds a variable of that kind; returns its id */
  addVariable: (kind: VariableKind) => string;
  /** Deletes an added variable — a starting one goes back to its value */
  removeVariable: (id: string) => void;
  /** All of the text styles, the starting ones included (see TextStyle) */
  textStyles: TextStyle[];
  /** One of the starting text styles: it can only go back to its look, not be deleted */
  isStartingTextStyle: (id: string) => boolean;
  setTextStyle: (style: TextStyle) => void;
  /** Adds a text style; returns its id */
  addTextStyle: () => string;
  /** Deletes an added text style (its texts get their field's starting one back) — a starting one goes back to its look */
  removeTextStyle: (id: string) => void;
  /** All of the components, the starting ones included (see DesignComponent) */
  components: DesignComponent[];
  /** One of the starting components: it can only go back to its look, not be deleted */
  isStartingComponent: (id: string) => boolean;
  /** Changes a main component — every instance of it, on every page */
  setComponent: (component: DesignComponent) => void;
  /** Changes (or adds) several at once — a component set's variants */
  setComponents: (components: DesignComponent[]) => void;
  /** Deletes several added ones at once (a set's variants) — a starting one among them goes back to its look */
  removeComponents: (ids: string[]) => void;
  /** Adds a copy of a component, to change on its own; returns its id */
  copyComponent: (id: string) => string;
  /** Deletes an added component (its instances go back to their type's own) — a starting one goes back to its look */
  removeComponent: (id: string) => void;
  /** What is drawn on the Bileşenler page on its own (see CanvasNode) */
  nodes: CanvasNode[];
  /** Changes them (functional: drags and typing never overwrite each other) */
  setNodes: (update: (nodes: CanvasNode[]) => CanvasNode[]) => void;
  /** Writes the parts that changed since the last save */
  save: () => Promise<void>;
  /** Changes with every edit (and save): effects holding `save` depend on it */
  revision: number;
  /** Everything is loaded: edits from here on are the user's (see the editor's undo) */
  loaded: boolean;
  /** What is stored, as it is now — the same objects until something changes (see restore) */
  stored: DesignSnapshot;
  /** Back to a snapshot (undo, redo): kept in memory, written only with the next save */
  restore: (snapshot: DesignSnapshot) => void;
}

/** The design system's own part of an undo step: what is stored, each list as it was. */
export interface DesignSnapshot {
  variables: DesignVariable[];
  textStyles: TextStyle[];
  components: DesignComponent[];
  nodes: CanvasNode[];
}

type Part = "variables" | "textStyles" | "components" | "canvas";

/** `base`, or `base 2`, `base 3`… — the first name no other has. */
function freeName(base: string, taken: { name: string }[]) {
  const names = new Set(taken.map((t) => t.name));
  let name = base;
  for (let n = 2; names.has(name); n++) name = `${base} ${n}`;
  return name;
}

/** `entry` in the place of the one with its id — at the end when there is none. */
function upsert<T extends { id: string }>(list: T[], entry: T): T[] {
  return list.some((e) => e.id === entry.id) ? list.map((e) => (e.id === entry.id ? entry : e)) : [...list, entry];
}

const NEW_VARIABLE: Record<VariableKind, { name: string; value: string | number }> = {
  color: { name: "Yeni renk", value: "#000000" },
  number: { name: "Yeni sayı", value: 16 },
  weight: { name: "Yeni kalınlık", value: 400 },
};

export function useDesignSystem(): DesignSystem {
  // Only what is stored: the starting variables, text styles and components are added on top of them.
  const [storedVariables, setStoredVariables] = useState<DesignVariable[]>([]);
  const [storedTextStyles, setStoredTextStyles] = useState<TextStyle[]>([]);
  const [storedComponents, setStoredComponents] = useState<DesignComponent[]>([]);
  const [nodes, setStoredNodes] = useState<CanvasNode[]>([]);
  const [changed, setChanged] = useState<ReadonlySet<Part>>(() => new Set());
  const [revision, setRevision] = useState(0);
  // The four lists loaded (whatever each found).
  const [loads, setLoads] = useState(0);
  const loadedOne = () => setLoads((n) => n + 1);
  const touch = (part: Part) => {
    setChanged((prev) => (prev.has(part) ? prev : new Set([...prev, part])));
    setRevision((r) => r + 1);
  };

  useEffect(() => {
    loadDesignVariables().then((list) => { setStoredVariables(list); loadedOne(); });
    loadTextStyles().then((list) => { setStoredTextStyles(list); loadedOne(); });
    loadCanvasNodes().then((list) => { setStoredNodes(list); loadedOne(); });
    // Before any component was stored they come from the legacy designs — stored with the next save.
    loadDesignComponents().then(({ components, fromLegacy }) => {
      setStoredComponents(components);
      loadedOne();
      if (!fromLegacy) return;
      setChanged((prev) => new Set([...prev, "components"]));
      setRevision((r) => r + 1);
    });
  }, []);

  // The same arrays while what is stored is the same: they are context values, read by every layer on the page.
  const variables = useMemo(() => withStartingVariables(storedVariables), [storedVariables]);
  const textStyles = useMemo(() => withStartingTextStyles(storedTextStyles), [storedTextStyles]);
  const components = useMemo(() => withStartingComponents(storedComponents), [storedComponents]);
  const stored = useMemo<DesignSnapshot>(
    () => ({ variables: storedVariables, textStyles: storedTextStyles, components: storedComponents, nodes }),
    [storedVariables, storedTextStyles, storedComponents, nodes]
  );

  const setVariable = (variable: DesignVariable) => {
    setStoredVariables((list) => upsert(list, variable));
    touch("variables");
  };
  const setTextStyle = (style: TextStyle) => {
    setStoredTextStyles((list) => upsert(list, style));
    touch("textStyles");
  };
  const setComponent = (component: DesignComponent) => {
    setStoredComponents((list) => upsert(list, component));
    touch("components");
  };

  return {
    variables,
    isStartingVariable: (id) => STARTING_VARIABLES.some((v) => v.id === id),
    setVariable,
    addVariable: (kind) => {
      const id = uid();
      setVariable({ id, name: freeName(NEW_VARIABLE[kind].name, variables), kind, light: { value: NEW_VARIABLE[kind].value } });
      return id;
    },
    removeVariable: (id) => {
      setStoredVariables((list) => list.filter((v) => v.id !== id));
      touch("variables");
    },
    textStyles,
    isStartingTextStyle: (id) => STARTING_TEXT_STYLES.some((s) => s.id === id),
    setTextStyle,
    addTextStyle: () => {
      const id = uid();
      setTextStyle(newTextStyle(id, freeName("Yeni metin stili", textStyles)));
      return id;
    },
    removeTextStyle: (id) => {
      setStoredTextStyles((list) => list.filter((s) => s.id !== id));
      touch("textStyles");
    },
    components,
    isStartingComponent,
    setComponent,
    setComponents: (list) => {
      setStoredComponents((stored) => list.reduce((all, component) => upsert(all, component), stored));
      touch("components");
    },
    removeComponents: (ids) => {
      setStoredComponents((stored) => stored.filter((c) => !ids.includes(c.id)));
      touch("components");
    },
    copyComponent: (id) => {
      const from = components.find((c) => c.id === id) ?? STARTING_COMPONENTS[0];
      const copy = copyComponent(from, uid(), freeName(`${from.name} kopyası`, components));
      setComponent(copy);
      return copy.id;
    },
    removeComponent: (id) => {
      setStoredComponents((list) => list.filter((c) => c.id !== id));
      touch("components");
    },
    nodes,
    setNodes: (update) => {
      setStoredNodes((list) => {
        const next = update(list);
        return next === list ? list : next;
      });
      touch("canvas");
    },
    save: async () => {
      const parts: [Part, () => Promise<void>][] = [
        ["variables", () => saveDesignVariables(storedVariables)],
        ["textStyles", () => saveTextStyles(storedTextStyles)],
        ["components", () => saveDesignComponents(storedComponents)],
        ["canvas", () => saveCanvasNodes(nodes)],
      ];
      for (const [part, write] of parts) {
        if (!changed.has(part)) continue;
        await write();
        setChanged((prev) => new Set([...prev].filter((p) => p !== part)));
      }
      setRevision((r) => r + 1);
    },
    revision,
    loaded: loads >= 4,
    stored,
    restore: (snapshot) => {
      setStoredVariables(snapshot.variables);
      setStoredTextStyles(snapshot.textStyles);
      setStoredComponents(snapshot.components);
      setStoredNodes(snapshot.nodes);
      // Whatever it was, the next save writes it.
      setChanged(new Set<Part>(["variables", "textStyles", "components", "canvas"]));
      setRevision((r) => r + 1);
    },
  };
}
