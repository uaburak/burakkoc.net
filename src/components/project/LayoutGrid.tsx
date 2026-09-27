import type { CSSProperties } from "react";
import type { Absolute, CellAlign, GridAlign, GridGap, GridSettings, GridTrack, LayoutFlow, PageFrame, PageSection, Sizing } from "@/types/project";
import { cn } from "@/lib/utils";
import { columnTracks, gridColumns, gridFlow, gridRows, layoutCells, rowTracks, type Cell } from "@/lib/projectLayout";
import { FillHeightContext, ProjectBlock } from "@/components/project/CoreBlocks";
import type { FrameLook } from "@/types/design";
import { useDesignVariables } from "@/components/project/designVariables";
import { frameLookStyle } from "@/components/project/frameLook";

/**
 * The layouts of the page, as Figma's auto layout: a section lays out its
 * groups (Blok), a group its components (Bileşen) — stacked, side by side (in
 * their list order) or on a grid: from md up the set column widths (twelfths
 * → fr), each child in its cell (layoutCells: where it was put, or the next
 * free one). One column on small screens, in reading order.
 */

const GAP_CLASS: Record<GridGap, string> = { sm: "gap-2", md: "gap-4", lg: "gap-8" };
const GAP_PX: Record<GridGap, number> = { sm: 8, md: 16, lg: 32 };

/** The grid's gaps in px: set ones, else its preset's. */
export function gridGaps(grid?: GridSettings): { column: number; row: number } {
  const preset = GAP_PX[grid?.gap ?? "md"];
  return { column: grid?.columnGap ?? preset, row: grid?.rowGap ?? preset };
}
const ALIGN_CLASS: Record<GridAlign, string> = { start: "items-start", center: "items-center", end: "items-end" };
/** The frame's alignment across: children narrower than their cells (from md up — small screens stack everything full width). */
const JUSTIFY_ITEMS: Record<GridAlign, string> = { start: "md:justify-items-start", center: "md:justify-items-center", end: "md:justify-items-end" };
/**
 * …and down, when the frame is taller than its rows: they gather in the
 * middle / at the bottom. At the top they keep filling it (rows stretch), so
 * a Fill height child still fills the frame.
 */
const ALIGN_CONTENT: Record<GridAlign, string | false> = { start: false, center: "md:content-center", end: "md:content-end" };
/** Where a child narrower than its cell sits (from md up; small screens stack everything full width). */
const JUSTIFY_SELF: Record<GridAlign, string> = { start: "md:justify-self-start", center: "md:justify-self-center", end: "md:justify-self-end" };
const ALIGN_SELF: Record<GridAlign, string> = { start: "md:self-start", center: "md:self-center", end: "md:self-end" };

/**
 * A column or row of a grid (Figma's grid): Fixed px; Fill a share of the
 * free space; Hug as big as its content — a column never wider than the
 * grid, a row as tall as its tallest child.
 */
function trackCss(track: GridTrack, axis: "column" | "row") {
  if (track.size === "fixed") return `${Math.max(0, Math.round(track.px ?? 0))}px`;
  if (track.size === "hug") return axis === "column" ? "fit-content(100%)" : "auto";
  return `minmax(0,${track.fr ?? 1}fr)`;
}

/** Stacked / side by side: along the flow (from md up; small screens stack everything full width). */
const JUSTIFY_CONTENT: Record<GridAlign, string> = { start: "md:justify-start", center: "md:justify-center", end: "md:justify-end" };
/** …and across it. */
const ITEMS: Record<GridAlign, string> = { start: "md:items-start", center: "md:items-center", end: "md:items-end" };
/** Side by side, wrapping: where the lines sit. */
const LINES: Record<GridAlign, string> = { start: "md:content-start", center: "md:content-center", end: "md:content-end" };

/**
 * Class and style of a layout container: its flow, gaps (px ones win over the
 * preset), padding and where its content sits (`justify` across, `align`
 * down — as Figma's alignment box). On a grid: its columns. Stacked / side by
 * side: one gap between the children, or the free space shared out between
 * them (`spread`, Figma's "Auto" gap).
 */
export function gridProps(grid?: GridSettings): { className: string; style: CSSProperties } {
  const px = (n?: number) => (n == null ? undefined : `${n}px`);
  // A side set on its own wins over its pair.
  const padding = {
    paddingLeft: px(grid?.paddingLeft ?? grid?.paddingX),
    paddingRight: px(grid?.paddingRight ?? grid?.paddingX),
    paddingTop: px(grid?.paddingTop ?? grid?.paddingY),
    paddingBottom: px(grid?.paddingBottom ?? grid?.paddingY),
  };
  const flow = gridFlow(grid);
  if (flow !== "grid") {
    const across = flow === "horizontal";
    const gaps = gridGaps(grid);
    // Along the flow: `justify` side by side, `align` stacked; across it, the other one.
    const along = (across ? grid?.justify : grid?.align) ?? "start";
    const cross = (across ? grid?.align : grid?.justify) ?? "start";
    // Side by side, wrapping: the lines too sit where the box says, the row gap between them.
    const wrap = across && grid?.wrap;
    return {
      className: cn(
        "relative flex w-full flex-col",
        across && "md:flex-row",
        wrap && cn("md:flex-wrap", LINES[cross]),
        grid?.spread ? "md:justify-between" : JUSTIFY_CONTENT[along],
        ITEMS[cross]
      ),
      style: { ...(wrap ? { columnGap: px(gaps.column), rowGap: px(gaps.row) } : { gap: px(across ? gaps.column : gaps.row) }), ...padding } as CSSProperties,
    };
  }
  const rows = rowTracks(grid);
  return {
    className: cn(
      "relative grid w-full grid-cols-1 md:grid-cols-(--grid-cols)",
      rows.length > 0 && "md:grid-rows-(--grid-rows)",
      GAP_CLASS[grid?.gap ?? "md"],
      ALIGN_CLASS[grid?.align ?? "start"],
      ALIGN_CONTENT[grid?.align ?? "start"],
      grid?.justify && JUSTIFY_ITEMS[grid.justify]
    ),
    style: {
      "--grid-cols": columnTracks(grid).map((t) => trackCss(t, "column")).join(" "),
      // Its set rows; more are added as the children need them, each as tall as its content.
      ...(rows.length > 0 ? { "--grid-rows": rows.map((t) => trackCss(t, "row")).join(" ") } : {}),
      columnGap: px(grid?.columnGap),
      rowGap: px(grid?.rowGap),
      ...padding,
    } as CSSProperties,
  };
}

/**
 * Class and style of a child out of its frame's auto layout (see Absolute):
 * from md up at `x` / `y` from the frame's top left (the frame is `relative`).
 */
export function absoluteProps(absolute?: Absolute): { className: string; style: CSSProperties } {
  if (!absolute) return { className: "", style: {} };
  return {
    className: "md:absolute md:left-(--abs-x) md:top-(--abs-y) md:m-0",
    style: { "--abs-x": `${Math.round(absolute.x)}px`, "--abs-y": `${Math.round(absolute.y)}px` } as CSSProperties,
  };
}

/**
 * Class and style of a child in its cell of the grid (from md up). Every cell
 * sets its own `--row`, `--col` and `--span` (custom properties inherit).
 */
export function cellProps(cell: Cell, flowing = false): { className: string; style: CSSProperties } {
  // Stacked / side by side (`flowing`): in its list order, no cell.
  if (flowing) return { className: "min-w-0", style: {} };
  return {
    className: "min-w-0 md:[grid-row:var(--row)] md:[grid-column:var(--col)/span_var(--span)]",
    style: { "--row": cell.row, "--col": cell.col, "--span": cell.span } as CSSProperties,
  };
}

/**
 * Class and style of a child's size in its cell (from md up — small screens
 * stack everything full width), as Figma's resizing. Width: Fill the cell
 * (default), Hug the content, or Fixed px. Height: Hug (default), Fill the
 * row's height, or Fixed px (content beyond it is clipped). With
 * `stretchChild` (a component's cell) a Fill / Fixed height is passed on to
 * the component inside; `fillHeight` then tells its media to stretch
 * (FillHeightContext) instead of keeping their aspect ratio. `align`: where it
 * sits inside its cell when narrower (Hug / Fixed width) or shorter (Hug /
 * Fixed height in a taller row).
 */
export function sizeProps(size: Sizing | undefined, stretchChild: boolean, align?: CellAlign, flow: LayoutFlow = "grid"): { className: string; style: CSSProperties; fillHeight: boolean } {
  const width = size?.width ?? "fill";
  // Its proportions kept: the height follows the width (an aspect ratio), whatever its own mode.
  const ratio = size?.ratio && size.ratio > 0 ? size.ratio : null;
  const height = ratio ? "fixed" : size?.height ?? "hug";
  const fixedWidth = width === "fixed" && size?.widthPx ? size.widthPx : null;
  const fixedHeight = !ratio && height === "fixed" && size?.heightPx ? size.heightPx : null;
  const fillHeight = height === "fill" || fixedHeight !== null || ratio !== null;
  const { minWidthPx: minW, maxWidthPx: maxW, minHeightPx: minH, maxHeightPx: maxH } = size ?? {};
  const limits = cn(
    // Never wider than its frame, whatever the max.
    minW && "md:min-w-[min(var(--size-min-w),100%)]",
    maxW && "md:max-w-[min(var(--size-max-w),100%)]",
    minH && "md:min-h-(--size-min-h)",
    maxH && "md:max-h-(--size-max-h) md:overflow-hidden",
    // As a fixed height: what reaches beyond it is cut off.
    ratio && "md:aspect-(--size-ratio) md:overflow-hidden"
  );
  const style = {
    ...(fixedWidth !== null ? { "--size-w": `${fixedWidth}px` } : {}),
    ...(ratio ? { "--size-ratio": String(ratio) } : {}),
    ...(fixedHeight !== null ? { "--size-h": `${fixedHeight}px` } : {}),
    ...(minW ? { "--size-min-w": `${minW}px` } : {}),
    ...(maxW ? { "--size-max-w": `${maxW}px` } : {}),
    ...(minH ? { "--size-min-h": `${minH}px` } : {}),
    ...(maxH ? { "--size-max-h": `${maxH}px` } : {}),
  } as CSSProperties;

  if (flow !== "grid") {
    // Stacked / side by side, as Figma: Fill takes the free space along the flow and the frame's size across it; the frame's alignment places the rest.
    const across = flow === "horizontal";
    return {
      className: cn(
        width === "fill" && (across ? "md:flex-1 md:min-w-0" : "md:self-stretch"),
        width === "hug" && "md:w-fit md:max-w-full md:flex-none",
        fixedWidth !== null && "md:w-(--size-w) md:max-w-full md:flex-none",
        height === "fill" && (across ? "md:self-stretch" : "md:flex-1 md:min-h-0"),
        fixedHeight !== null && "md:h-(--size-h) md:overflow-hidden md:flex-none",
        // Its height follows its width: never stretched or squeezed along the flow.
        ratio && !(width === "fill" && across) && "md:flex-none",
        fillHeight && stretchChild && "md:flex md:flex-col md:[&>*]:flex-1 md:[&>*]:min-h-0",
        limits
      ),
      style,
      fillHeight: fillHeight && stretchChild,
    };
  }

  return {
    className: cn(
      // Full width in its cell — on small screens always; from md up only when it fills (else `align.x` places it).
      "justify-self-stretch",
      // Narrower than its cell: where its own alignment says — unset, where its frame's does (justify-items).
      (width === "hug" || fixedWidth !== null) && (align?.x ? JUSTIFY_SELF[align.x] : "md:justify-self-auto"),
      width === "hug" && "md:w-fit md:max-w-full",
      fixedWidth !== null && "md:w-(--size-w) md:max-w-full",
      // Down: a Fill height stretches to the row; otherwise `align.y` (unset: the grid's align).
      height === "fill" ? "md:self-stretch" : align?.y && ALIGN_SELF[align.y],
      fixedHeight !== null && "md:h-(--size-h) md:overflow-hidden",
      fillHeight && stretchChild && "md:flex md:flex-col md:[&>*]:flex-1 md:[&>*]:min-h-0",
      limits
    ),
    style,
    fillHeight: fillHeight && stretchChild,
  };
}

// ── Inside a component (its main component, see ComponentDesign) ──────────────
//
// The same auto layout as above, but at every width — a component's items keep
// their layout on a phone too — so as plain styles, not breakpoint classes.

const CSS_ALIGN: Record<GridAlign, "start" | "center" | "end"> = { start: "start", center: "center", end: "end" };
const FLEX_ALIGN: Record<GridAlign, "flex-start" | "center" | "flex-end"> = { start: "flex-start", center: "center", end: "flex-end" };

/** The style of a frame inside a component: its flow, gaps, padding and where its content sits (see gridProps). */
export function innerLayoutStyle(grid?: GridSettings): CSSProperties {
  const px = (n?: number) => (n == null ? undefined : `${n}px`);
  const padding = {
    paddingLeft: px(grid?.paddingLeft ?? grid?.paddingX),
    paddingRight: px(grid?.paddingRight ?? grid?.paddingX),
    paddingTop: px(grid?.paddingTop ?? grid?.paddingY),
    paddingBottom: px(grid?.paddingBottom ?? grid?.paddingY),
  };
  const gaps = gridGaps(grid);
  const flow = gridFlow(grid);
  if (flow !== "grid") {
    const across = flow === "horizontal";
    const along = (across ? grid?.justify : grid?.align) ?? "start";
    const cross = (across ? grid?.align : grid?.justify) ?? "start";
    const wrap = across && Boolean(grid?.wrap);
    return {
      display: "flex",
      flexDirection: across ? "row" : "column",
      flexWrap: wrap ? "wrap" : undefined,
      alignContent: wrap ? FLEX_ALIGN[cross] : undefined,
      justifyContent: grid?.spread ? "space-between" : FLEX_ALIGN[along],
      alignItems: FLEX_ALIGN[cross],
      ...(wrap ? { columnGap: px(gaps.column), rowGap: px(gaps.row) } : { gap: px(across ? gaps.column : gaps.row) }),
      width: "100%",
      ...padding,
    };
  }
  const rows = rowTracks(grid);
  const align = grid?.align ?? "start";
  return {
    display: "grid",
    gridTemplateColumns: columnTracks(grid).map((t) => trackCss(t, "column")).join(" "),
    gridTemplateRows: rows.length > 0 ? rows.map((t) => trackCss(t, "row")).join(" ") : undefined,
    columnGap: px(gaps.column),
    rowGap: px(gaps.row),
    alignItems: CSS_ALIGN[align],
    // Taller than its rows: they gather in the middle / at the bottom; at the top they keep filling it.
    alignContent: align === "start" ? undefined : CSS_ALIGN[align],
    justifyItems: grid?.justify ? CSS_ALIGN[grid.justify] : undefined,
    width: "100%",
    ...padding,
  };
}

/** The style of a child's size in a frame inside a component (see sizeProps): Fill / Hug / Fixed, its limits, and where it sits when narrower. */
export function innerChildStyle(size: Sizing | undefined, align: CellAlign | undefined, flow: LayoutFlow): CSSProperties {
  const width = size?.width ?? "fill";
  // Its proportions kept: the height follows the width (see sizeProps).
  const ratio = size?.ratio && size.ratio > 0 ? size.ratio : null;
  const height = ratio ? "fixed" : size?.height ?? "hug";
  const fixedWidth = width === "fixed" && size?.widthPx ? size.widthPx : null;
  const fixedHeight = !ratio && height === "fixed" && size?.heightPx ? size.heightPx : null;
  const limits: CSSProperties = {
    minWidth: size?.minWidthPx ? `min(${size.minWidthPx}px, 100%)` : undefined,
    maxWidth: size?.maxWidthPx ? `min(${size.maxWidthPx}px, 100%)` : undefined,
    minHeight: size?.minHeightPx ? `${size.minHeightPx}px` : undefined,
    maxHeight: size?.maxHeightPx ? `${size.maxHeightPx}px` : undefined,
    overflow: size?.maxHeightPx || fixedHeight !== null || ratio ? "hidden" : undefined,
  };
  const narrow = width === "hug" || fixedWidth !== null;
  const own = {
    width: width === "hug" ? "fit-content" : fixedWidth !== null ? `${fixedWidth}px` : undefined,
    height: fixedHeight !== null ? `${fixedHeight}px` : undefined,
    aspectRatio: ratio ? String(ratio) : undefined,
  };
  if (flow !== "grid") {
    // Stacked / side by side: Fill takes the free space along the flow and the frame's size across it.
    const across = flow === "horizontal";
    return {
      ...own,
      maxWidth: narrow ? "100%" : undefined,
      flex: (width === "fill" && across) || (height === "fill" && !across) ? "1 1 0%" : narrow || fixedHeight !== null || ratio ? "none" : undefined,
      alignSelf: (width === "fill" && !across) || (height === "fill" && across) ? "stretch" : undefined,
      ...(width === "fill" && across ? { minWidth: 0 } : {}),
      ...(height === "fill" && !across ? { minHeight: 0 } : {}),
      ...Object.fromEntries(Object.entries(limits).filter(([, v]) => v !== undefined)),
    };
  }
  return {
    ...own,
    maxWidth: narrow ? "100%" : undefined,
    // Narrower than its cell: where its own alignment says — unset, where its frame's does.
    justifySelf: narrow ? (align?.x ? CSS_ALIGN[align.x] : "auto") : "stretch",
    alignSelf: height === "fill" ? "stretch" : align?.y ? CSS_ALIGN[align.y] : undefined,
    ...Object.fromEntries(Object.entries(limits).filter(([, v]) => v !== undefined)),
  };
}

/** Children with their cells, in reading order — the order on small screens; stacked / side by side, in their list order. */
function inCells<T extends { span?: number; row?: number; col?: number }>(children: T[], grid?: GridSettings) {
  const cells = layoutCells(children, gridColumns(grid).length, gridRows(grid));
  const list = children.map((child, i) => ({ child, cell: cells[i] }));
  return gridFlow(grid) === "grid" ? list.sort((a, b) => a.cell.row - b.cell.row || a.cell.col - b.cell.col) : list;
}

/**
 * Class and style of the page's frame (PageFrame): the box of its sections
 * and dividers, stacked, in the page's column — Fill (the column) unless its
 * W says otherwise, a narrower one in the column's middle. Its alignment box
 * places sections narrower than it (across) and its content when it is
 * taller (down).
 */
export function pageFrameProps(frame?: PageFrame): { className: string; style: CSSProperties } {
  const size = sizeProps(frame?.size, false, undefined, "vertical");
  const narrower = (frame?.size?.width ?? "fill") !== "fill";
  return {
    className: cn(
      "flex flex-col w-full",
      ITEMS[frame?.justify ?? "start"],
      JUSTIFY_CONTENT[frame?.align ?? "start"],
      size.className,
      // A fixed height never crops the page: what reaches beyond it shows (Figma's frame without Clip content).
      "md:overflow-visible",
      narrower && "md:self-center"
    ),
    style: size.style,
  };
}

/** A section in the page's frame: as wide as its frame — the whole column when its W is Fill. */
export function sectionWidthClass(section: Pick<PageSection, "size">) {
  return (section.size?.width ?? "fill") === "fill" ? "w-full" : "w-full md:w-fit md:max-w-full";
}

/**
 * Class and style of a section's frame — its layout container — in the page's
 * column: sized as its W / H say (a child of a stack: see sizeProps).
 */
export function sectionFrameProps(section: Pick<PageSection, "grid" | "size">): { className: string; style: CSSProperties } {
  const layout = gridProps(section.grid);
  const size = sizeProps(section.size, false, undefined, "vertical");
  return { className: cn(layout.className, size.className), style: { ...layout.style, ...size.style } };
}

/** A section's content on the public page: its groups, each a grid of its components — each frame with its look (see FrameLook). */
export function SectionContent({ section, animate = false }: { section: PageSection; animate?: boolean }) {
  const outer = sectionFrameProps(section);
  const variables = useDesignVariables();
  const look = (frame: { look?: FrameLook }) => frameLookStyle(frame.look, variables);
  return (
    <div className={outer.className} style={{ ...outer.style, ...look(section) }}>
      {inCells(section.groups, section.grid).map(({ child: group, cell: groupCell }) => {
        const cell = cellProps(groupCell, gridFlow(section.grid) !== "grid" || Boolean(group.absolute));
        const inner = gridProps(group.grid);
        const size = sizeProps(group.size, false, group.cellAlign, gridFlow(section.grid));
        const free = absoluteProps(group.absolute);
        return (
          <div key={group.id} className={cn(cell.className, inner.className, size.className, free.className)} style={{ ...cell.style, ...inner.style, ...size.style, ...free.style, ...look(group) }}>
            {inCells(group.blocks, group.grid).map(({ child: block, cell: blockCell }) => {
              const c = cellProps(blockCell, gridFlow(group.grid) !== "grid" || Boolean(block.absolute));
              const s = sizeProps(block.size, true, block.cellAlign, gridFlow(group.grid));
              const f = absoluteProps(block.absolute);
              return (
                <div key={block.id} className={cn("w-full", c.className, s.className, f.className)} style={{ ...c.style, ...s.style, ...f.style, ...look(block) }}>
                  <FillHeightContext.Provider value={s.fillHeight}>
                    <ProjectBlock block={block} animate={animate} />
                  </FillHeightContext.Provider>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
