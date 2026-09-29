"use client";

import { createContext, memo, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { DesignVariable } from "@/types/design";
import { MOTION_CSS } from "@/components/project/interactions";
import { colorWithAlpha, nodeCss, motionCss } from "./css";
import { PATH_SEP, findComponent, isFrameLike, resolveInstance, setOf, type FrameNode, type LayoutGrid, type LayoutMode, type Reaction, type SceneNode, type TextNode } from "./model";

/**
 * The nodes drawn as DOM — the editor's canvas and the site's page share it.
 * Each element carries `data-node-id` (a layer inside an instance: the
 * instance's id, "/", the layer's name path — see NodeOverride) so the
 * canvas can find what is under the pointer and outline it.
 *
 * Instances draw their main component's layers with their overrides; with
 * prototyping on (the site, the preview) an instance turns into another
 * variant on its reactions — the same elements stay (keyed by name), so
 * Smart animate transitions them.
 */

export interface RenderContext {
  nodes: readonly SceneNode[];
  byId: Map<string, DesignVariable>;
  lang: "tr" | "en";
  /** Prototypes play: reactions turn instances into other variants */
  play: boolean;
  /** The text being typed in place (the editor), and where its words go */
  editing?: { id: string; onInput: (id: string, text: string) => void; onDone: () => void } | null;
}

export const RenderContextCtx = createContext<RenderContext>({ nodes: [], byId: new Map(), lang: "tr", play: false });

/** A text's words in the language shown (the Turkish ones when there are no English). */
export const textOf = (node: TextNode, lang: "tr" | "en") => (lang === "en" ? node.charactersEn || node.characters : node.characters);

/** A text typed in place: the same element, contentEditable — its words written on every keystroke (never re-seeded, so the caret stays). */
function EditableTextNode({ node, style, id }: { node: TextNode; style: CSSProperties; id: string }) {
  const ctx = useContext(RenderContextCtx);
  const ref = useRef<HTMLDivElement>(null);
  const editing = ctx.editing;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.textContent = textOf(node, ctx.lang);
    el.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const read = () => {
    const el = ref.current;
    if (!el) return "";
    let text = el.innerText.replace(/ /g, " ");
    if (text.endsWith("\n")) text = text.slice(0, -1);
    return text;
  };
  return (
    <div
      ref={ref}
      data-node-id={id}
      data-node-type="text"
      data-editing=""
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck={false}
      style={{ ...style, outline: "none", cursor: "text", minWidth: 4 }}
      onInput={() => editing?.onInput(node.id, read())}
      onBlur={() => editing?.onDone()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          ref.current?.blur();
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function TextView({ node, parentLayout, id, zIndex }: { node: TextNode; parentLayout: LayoutMode; id: string; zIndex?: number }) {
  const ctx = useContext(RenderContextCtx);
  const style = { ...nodeCss(node, parentLayout, ctx.byId), zIndex };
  if (ctx.editing && ctx.editing.id === id) return <EditableTextNode node={node} style={style} id={id} />;
  const words = textOf(node, ctx.lang);
  return (
    <div data-node-id={id} data-node-type="text" data-text-style={node.textStyle} style={style}>
      {words || (ctx.editing !== undefined ? <span style={{ opacity: 0.3 }}>Metin</span> : null)}
    </div>
  );
}

/** One instance's prototype: the variant it shows now, its animation, and the handlers its frame gets. */
function useReactions(instanceId: string, mainId: string | undefined) {
  const ctx = useContext(RenderContextCtx);
  const [shown, setShown] = useState<string | undefined>(undefined);
  const [motion, setMotion] = useState<{ reaction: Reaction; key: number } | null>(null);
  const back = useRef<{ id: string; via: "hover" | "press" } | null>(null);
  const currentId = shown ?? mainId;
  const current = currentId ? findComponent(ctx.nodes, currentId) : null;
  const reactions = ctx.play ? current?.reactions ?? [] : [];
  const set = current ? setOf(ctx.nodes, current.id) : null;
  const change = useCallback((reaction: Reaction, from?: { id: string; via: "hover" | "press" }) => {
    back.current = from ?? null;
    setShown(reaction.target);
    setMotion(reaction.animation === "instant" ? null : { reaction, key: Date.now() });
  }, []);
  const goBack = useCallback((via?: "hover" | "press") => {
    const b = back.current;
    if (!b || (via && b.via !== via)) return;
    back.current = null;
    setShown(b.id);
    setMotion((m) => (m ? { ...m, key: Date.now() } : m));
  }, []);
  // An animation over, its attribute goes.
  useEffect(() => {
    if (!motion) return;
    const t = window.setTimeout(() => setMotion((m) => (m?.key === motion.key ? null : m)), motion.reaction.duration + 60);
    return () => window.clearTimeout(t);
  }, [motion]);
  // "After delay": once the variant shows.
  const delayed = reactions.find((r) => r.trigger === "delay");
  useEffect(() => {
    if (!delayed) return;
    const t = window.setTimeout(() => change(delayed), delayed.delay ?? 800);
    return () => window.clearTimeout(t);
  }, [delayed, change, currentId]);
  const on = (trigger: Reaction["trigger"]) => reactions.find((r) => r.trigger === trigger && (!set || set.children.some((c) => c.id === r.target)));
  const click = on("click");
  const handlers = ctx.play
    ? {
        onClick: click ? (e: React.MouseEvent) => { e.stopPropagation(); change(click); } : undefined,
        onPointerEnter: () => { const h = on("hover"); if (h && currentId) change(h, { id: currentId, via: "hover" }); },
        onPointerLeave: () => goBack("hover"),
        onPointerDown: () => { const p = on("press"); if (p && currentId) change(p, { id: currentId, via: "press" }); },
        onPointerUp: () => goBack("press"),
        style: { ...(motion ? motionCss(motion.reaction.animation, motion.reaction.easing, motion.reaction.duration) : {}), ...(click ? { cursor: "pointer" } : {}) } as CSSProperties,
        "data-variant-motion": motion?.reaction.animation,
      }
    : null;
  void instanceId;
  return { shownId: shown, handlers };
}

function InstanceView({ node, parentLayout, id, zIndex }: { node: FrameNode; parentLayout: LayoutMode; id: string; zIndex?: number }) {
  const ctx = useContext(RenderContextCtx);
  const { shownId, handlers } = useReactions(node.id, node.mainId);
  const resolved = useMemo(() => resolveInstance(ctx.nodes, node, shownId), [ctx.nodes, node, shownId]);
  if (!resolved) {
    return (
      <div data-node-id={id} data-node-type="instance" style={{ ...nodeCss(node, parentLayout, ctx.byId), zIndex, outline: "1px dashed var(--edit-component, #9747ff)" }} />
    );
  }
  const { style: playStyle, ...play } = handlers ?? {};
  return (
    <FrameBox
      node={resolved}
      parentLayout={parentLayout}
      id={id}
      type="instance"
      extraStyle={{ ...playStyle, zIndex }}
      extraProps={play}
      childId={(child) => `${id}/${child}`}
      keyOf={(child) => child.name}
    />
  );
}

function FrameBox({ node, parentLayout, id, type, extraStyle, extraProps, childId, keyOf }: {
  node: FrameNode;
  parentLayout: LayoutMode;
  id: string;
  type: string;
  extraStyle?: CSSProperties;
  extraProps?: Record<string, unknown>;
  /** A child's data-node-id: its own id, or — inside an instance — the instance's id and its name path */
  childId?: (namePath: string, child: SceneNode) => string;
  keyOf?: (child: SceneNode) => string;
}) {
  const ctx = useContext(RenderContextCtx);
  const style = { ...nodeCss(node, parentLayout, ctx.byId), ...extraStyle };
  return (
    <div data-node-id={id} data-node-type={type} style={style} {...extraProps}>
      <Children parent={node} childId={childId} keyOf={keyOf} path="" />
      {ctx.editing !== undefined && node.layoutGrids?.some((g) => g.visible !== false) && <LayoutGrids grids={node.layoutGrids} />}
    </div>
  );
}

/** Figma's layout grids over a frame — the editor only: its columns, rows or square grid, in their colour. */
function LayoutGrids({ grids }: { grids: LayoutGrid[] }) {
  return (
    <>
      {grids.filter((g) => g.visible !== false).map((g, i) => {
        const tint = colorWithAlpha(g.color, g.opacity);
        if (g.type === "grid") {
          const size = Math.max(1, g.size);
          return <div key={i} aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: `linear-gradient(to right, ${tint} 1px, transparent 1px), linear-gradient(to bottom, ${tint} 1px, transparent 1px)`, backgroundSize: `${size}px ${size}px` }} />;
        }
        const cells = Array.from({ length: Math.max(1, g.count) });
        return (
          <div key={i} aria-hidden className="pointer-events-none absolute flex" style={{ inset: g.margin, gap: g.gutter, flexDirection: g.type === "columns" ? "row" : "column" }}>
            {cells.map((_, j) => <span key={j} className="flex-1" style={{ background: tint }} />)}
          </div>
        );
      })}
    </>
  );
}

function Children({ parent, childId, keyOf, path }: { parent: FrameNode; childId?: (namePath: string, child: SceneNode) => string; keyOf?: (child: SceneNode) => string; path: string }) {
  return (
    <>
      {parent.children.map((child) => {
        const namePath = path ? `${path}${PATH_SEP}${child.name}` : child.name;
        const id = childId ? childId(namePath, child) : child.id;
        const key = keyOf ? keyOf(child) : child.id;
        if (childId && isFrameLike(child) && child.type !== "instance") {
          // Inside an instance: nested frames carry the name path on.
          return <NestedFrame key={key} node={child} parentLayout={parent.layoutMode} id={id} childId={childId} keyOf={keyOf} path={namePath} />;
        }
        return <NodeView key={key} node={child} parentLayout={parent.layoutMode} id={id} zIndex={parent.firstOnTop ? parent.children.length - parent.children.indexOf(child) : undefined} />;
      })}
    </>
  );
}

function NestedFrame({ node, parentLayout, id, childId, keyOf, path }: { node: FrameNode; parentLayout: LayoutMode; id: string; childId: (namePath: string, child: SceneNode) => string; keyOf?: (child: SceneNode) => string; path: string }) {
  const ctx = useContext(RenderContextCtx);
  return (
    <div data-node-id={id} data-node-type={node.type} style={nodeCss(node, parentLayout, ctx.byId)}>
      <Children parent={node} childId={childId} keyOf={keyOf} path={path} />
    </div>
  );
}

/** A node, drawn — `id` is what its element is found by (its own id unless it is inside an instance). */
export const NodeView = memo(function NodeView({ node, parentLayout, id, zIndex }: { node: SceneNode; parentLayout: LayoutMode; id?: string; zIndex?: number }) {
  const ctx = useContext(RenderContextCtx);
  const key = id ?? node.id;
  if (node.type === "text") return <TextView node={node} parentLayout={parentLayout} id={key} zIndex={zIndex} />;
  if (node.type === "instance") return <InstanceView node={node} parentLayout={parentLayout} id={key} zIndex={zIndex} />;
  if (isFrameLike(node)) return <FrameBox node={node} parentLayout={parentLayout} id={key} type={node.type} extraStyle={zIndex !== undefined ? { zIndex } : undefined} />;
  return <div data-node-id={key} data-node-type={node.type} style={{ ...nodeCss(node, parentLayout, ctx.byId), zIndex }} />;
});

/** The prototypes' animations, once on the page. */
export function MotionStyle() {
  return <style>{MOTION_CSS}</style>;
}

/** The context's provider, for the canvas and the page. */
export function RenderProvider({ value, children }: { value: RenderContext; children: ReactNode }) {
  return <RenderContextCtx.Provider value={value}>{children}</RenderContextCtx.Provider>;
}
