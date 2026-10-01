"use client";

import { createContext, memo, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { DesignVariable } from "@/types/design";
import { MOTION_CSS } from "@/components/project/interactions";
import { isSafeHref, renderRichText } from "@/components/project/RichText";
import { ZoomableImage } from "@/components/ZoomableImage";
import { colorWithAlpha, fillsCss, frameLayoutCss, nodeCss, motionCss } from "./css";
import { EmbedView } from "./EmbedView";
import { PATH_SEP, findComponent, isFrameLike, resolveInstance, setOf, type FrameNode, type LayoutGrid, type LayoutMode, type Paint, type Reaction, type SceneNode, type ShapeNode, type TextNode } from "./model";

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
 *
 * On the site (`site`) the page also does what a page does: its links go
 * where they point, its pictures open larger on a click, what the site's
 * code draws (see Embed) works. A text's **bold** and [links](https://…)
 * are drawn as such everywhere but while it is typed in.
 */

export interface RenderContext {
  nodes: readonly SceneNode[];
  byId: Map<string, DesignVariable>;
  lang: "tr" | "en";
  /** Prototypes play: reactions turn instances into other variants */
  play: boolean;
  /** The text being typed in place (the editor), and where its words go */
  editing?: { id: string; onInput: (id: string, text: string) => void; onDone: () => void } | null;
  /** The site's page: links, pictures that open larger, embeds that work */
  site?: boolean;
}

/** A grid's columns, on its element: the site's page has fewer of them on a phone (see PAGE_CSS). */
const gridOf = (node: FrameNode) => (node.layoutMode === "grid" ? Math.max(1, node.gridColumns ?? 2) : undefined);

/** The room a page keeps over its content on a screen too narrow for what stands beside it (the way back, the contents). */
export const PAGE_TOP_NARROW = 40;

/** A frame's layers stacked, one to a row, as wide as it (see FrameNode.narrow): the site's page on a narrower screen. */
const stackCss = (at: string) => `
  [data-canvas-page] [data-narrow="${at}"][data-grid] { grid-template-columns: minmax(0, 1fr) !important; grid-template-rows: none !important; }
  [data-canvas-page] [data-narrow="${at}"]:not([data-grid]) { flex-direction: column !important; flex-wrap: nowrap !important; }
  [data-canvas-page] [data-narrow="${at}"] > [data-node-id] { grid-column: auto !important; grid-row: auto !important; align-self: stretch !important; justify-self: stretch !important; width: auto !important; max-width: 100% !important; min-width: 0 !important; height: auto !important; flex: none !important; position: relative !important; left: auto !important; top: auto !important; }`;

/**
 * The site's page on narrower screens — the file itself has no breakpoints:
 * under 1280px (nothing stands beside the page) it keeps 40px over its
 * content, however much its frame has (`--page-lift`: what is taken off);
 * frames marked to (see FrameNode.narrow) stack their layers under 768px
 * or 640px, or keep two columns under 640px; on a phone (under 640px) an
 * unmarked grid of three columns or more has two.
 */
export const PAGE_CSS = `@media (max-width: 1279px) {
  [data-canvas-page] { margin-top: calc(-1 * var(--page-lift, 0px)); }
}
@media (max-width: 767px) {${stackCss("stack")}
}
@media (max-width: 639px) {${stackCss("stack-sm")}
  [data-canvas-page] [data-narrow="two"][data-grid] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
  [data-canvas-page] [data-narrow="two"] > [data-node-id] { grid-column: auto !important; grid-row: auto !important; }
  ${[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => `[data-canvas-page] [data-grid="${n}"]:not([data-narrow])`).join(", ")} { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
}`;

/** Inside a link (on the site): no link of its own — HTML has no link inside a link. */
const InLinkCtx = createContext(false);

/** The least size (px, each way) of a picture that opens larger on the site: an avatar or an icon doesn't. */
const ZOOM_FROM = 120;

/** The picture a shape shows that opens larger on a click (the site's pages): its topmost fill, when that is an image. */
function zoomable(node: SceneNode): Paint | null {
  if (node.type !== "rectangle" && node.type !== "ellipse") return null;
  if (node.width < ZOOM_FROM || node.height < ZOOM_FROM) return null;
  const top = node.fills.find((p) => p.visible !== false);
  return top?.type === "image" && top.image?.url && top.image.fit !== "tile" ? top : null;
}

/**
 * A shape showing a picture, on the site: the picture itself (it opens
 * larger on a click) in a box clipped to the shape's corners, over the
 * shape's other fills; its shadows and strokes drawn as the shape's — those
 * inside it again over the picture.
 */
function PictureView({ node, paint, style, id }: { node: ShapeNode; paint: Paint; style: CSSProperties; id: string }) {
  const ctx = useContext(RenderContextCtx);
  const { boxShadow, backgroundColor, backgroundImage, backgroundSize, backgroundRepeat, backgroundPosition, ...box } = style;
  void backgroundColor; void backgroundImage; void backgroundSize; void backgroundRepeat; void backgroundPosition;
  const under = fillsCss(node.fills.filter((p) => p !== paint), ctx.byId);
  const image = paint.image!;
  return (
    <div data-node-id={id} data-node-type={node.type} data-picture="" style={{ ...box, ...under, boxShadow }}>
      <span className="absolute inset-0 block overflow-hidden" style={{ borderRadius: "inherit" }}>
        <ZoomableImage src={image.url} alt="" draggable={false} className={image.fit === "fit" ? "block w-full h-full object-contain" : "block w-full h-full object-cover"} />
        {boxShadow && <span aria-hidden className="pointer-events-none absolute inset-0" style={{ boxShadow, borderRadius: "inherit" }} />}
      </span>
    </div>
  );
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
  const inLink = useContext(InLinkCtx);
  const style = { ...nodeCss(node, parentLayout, ctx.byId), zIndex };
  if (ctx.editing && ctx.editing.id === id) return <EditableTextNode node={node} style={style} id={id} />;
  const words = textOf(node, ctx.lang);
  return (
    <div data-node-id={id} data-node-type="text" data-text-style={node.textStyle} style={style}>
      {/* Its links: to follow on the site only — the editor's canvas and its preview draw them without an anchor. */}
      {words ? renderRichText(words, { links: Boolean(ctx.site) && !inLink }) : ctx.editing !== undefined ? <span style={{ opacity: 0.3 }}>Text</span> : null}
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
  const inLink = useContext(InLinkCtx);
  const style = { ...nodeCss(node, parentLayout, ctx.byId), ...extraStyle };
  // What the site's code draws in its place (see Embed): as tall as it is drawn — inside a link, without links of its own (its badges).
  if (node.embed) {
    return (
      <div data-node-id={id} data-node-type={type} style={style} {...extraProps}>
        <EmbedView embed={inLink ? { ...node.embed, badges: undefined } : node.embed} id={id} site={Boolean(ctx.site) && !inLink} lang={ctx.lang} />
      </div>
    );
  }
  const content = (
    <>
      <Children parent={node} childId={childId} keyOf={keyOf} path="" />
      {ctx.editing !== undefined && node.layoutGrids?.some((g) => g.visible !== false) && <LayoutGrids grids={node.layoutGrids} />}
      {ctx.editing !== undefined && node.layoutMode === "grid" && <GridCells frame={node} byId={ctx.byId} />}
    </>
  );
  // A link, on the site: the frame itself is what is clicked (what is inside it links nowhere of its own).
  if (ctx.site && !inLink && node.href && isSafeHref(node.href)) {
    const outside = /^https?:\/\//i.test(node.href);
    return (
      <a data-node-id={id} data-node-type={type} data-grid={gridOf(node)} data-narrow={node.narrow} href={node.href} {...(outside ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="transition-[filter,scale] duration-200 hover:brightness-95 active:scale-[0.97]" style={{ ...style, color: "inherit", textDecoration: "none", cursor: "pointer" }} {...extraProps}>
        <InLinkCtx.Provider value={true}>{content}</InLinkCtx.Provider>
      </a>
    );
  }
  return (
    <div data-node-id={id} data-node-type={type} data-grid={gridOf(node)} data-narrow={node.narrow} style={style} {...extraProps}>
      {content}
    </div>
  );
}

/** A grid's cells outlined — the editor only, and only while the frame is selected (see EDITOR_CSS): its columns × rows (as many rows as its children fill, when Auto). */
function GridCells({ frame, byId }: { frame: FrameNode; byId: Map<string, DesignVariable> }) {
  const layout = frameLayoutCss(frame, byId);
  const cols = Math.max(1, frame.gridColumns ?? 2);
  const rows = frame.gridRows ?? Math.max(1, Math.ceil(frame.children.length / cols));
  return (
    <div data-grid-cells="" aria-hidden className="pointer-events-none absolute inset-0 grid" style={{ boxSizing: "border-box", paddingTop: layout.paddingTop, paddingRight: layout.paddingRight, paddingBottom: layout.paddingBottom, paddingLeft: layout.paddingLeft, columnGap: layout.columnGap, rowGap: layout.rowGap, gridTemplateColumns: layout.gridTemplateColumns ?? `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
      {Array.from({ length: cols * rows }).map((_, i) => <span key={i} style={{ boxShadow: "inset 0 0 0 1px var(--edit-accent, #0d99ff)", opacity: 0.5 }} />)}
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
  const ctx = useContext(RenderContextCtx);
  return (
    <>
      {parent.children.map((child) => {
        // A hidden layer isn't on the site at all — nor its pictures, loading for nothing.
        if (ctx.site && child.visible === false) return null;
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
    <div data-node-id={id} data-node-type={node.type} data-grid={gridOf(node)} data-narrow={node.narrow} style={nodeCss(node, parentLayout, ctx.byId)}>
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
  const style = { ...nodeCss(node, parentLayout, ctx.byId), zIndex };
  const paint = ctx.site ? zoomable(node) : null;
  if (paint && (node.type === "rectangle" || node.type === "ellipse")) return <PictureView node={node} paint={paint} style={style} id={key} />;
  return <div data-node-id={key} data-node-type={node.type} style={style} />;
});

/** The prototypes' animations, once on the page. */
export function MotionStyle() {
  return <style>{MOTION_CSS}</style>;
}

/** The context's provider, for the canvas and the page. */
export function RenderProvider({ value, children }: { value: RenderContext; children: ReactNode }) {
  return <RenderContextCtx.Provider value={value}>{children}</RenderContextCtx.Provider>;
}
