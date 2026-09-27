import type { CSSProperties } from "react";
import type { CellAlign, GridAlign, GridGap, GridSettings, PageSection, Sizing } from "@/types/project";
import { cn } from "@/lib/utils";
import { gridColumns, gridRows, layoutCells, type Cell } from "@/lib/projectLayout";
import { FillHeightContext, ProjectBlock } from "@/components/project/CoreBlocks";

/**
 * The grids of the page: a section lays out its groups (Blok), a group its
 * components (Bileşen). One column on small screens, in reading order; from
 * md up the set column widths (twelfths → fr), each child in its cell
 * (layoutCells: where it was put, or the next free one).
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

/** Class and style of a grid container: its columns, gaps (px ones win over the preset), padding and where its content sits (`justify` / `align`). */
export function gridProps(grid?: GridSettings): { className: string; style: CSSProperties } {
  const px = (n?: number) => (n == null ? undefined : `${n}px`);
  return {
    className: cn(
      "grid w-full grid-cols-1 md:grid-cols-(--grid-cols)",
      GAP_CLASS[grid?.gap ?? "md"],
      ALIGN_CLASS[grid?.align ?? "start"],
      ALIGN_CONTENT[grid?.align ?? "start"],
      grid?.justify && JUSTIFY_ITEMS[grid.justify]
    ),
    style: {
      "--grid-cols": gridColumns(grid).map((c) => `minmax(0,${c}fr)`).join(" "),
      columnGap: px(grid?.columnGap),
      rowGap: px(grid?.rowGap),
      paddingLeft: px(grid?.paddingX),
      paddingRight: px(grid?.paddingX),
      paddingTop: px(grid?.paddingY),
      paddingBottom: px(grid?.paddingY),
    } as CSSProperties,
  };
}

/**
 * Class and style of a child in its cell of the grid (from md up). Every cell
 * sets its own `--row`, `--col` and `--span` (custom properties inherit).
 */
export function cellProps(cell: Cell): { className: string; style: CSSProperties } {
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
export function sizeProps(size: Sizing | undefined, stretchChild: boolean, align?: CellAlign): { className: string; style: CSSProperties; fillHeight: boolean } {
  const width = size?.width ?? "fill";
  const height = size?.height ?? "hug";
  const fixedWidth = width === "fixed" && size?.widthPx ? size.widthPx : null;
  const fixedHeight = height === "fixed" && size?.heightPx ? size.heightPx : null;
  const fillHeight = height === "fill" || fixedHeight !== null;
  const { minWidthPx: minW, maxWidthPx: maxW, minHeightPx: minH, maxHeightPx: maxH } = size ?? {};
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
      // Limits: never wider than the cell, whatever the max.
      minW && "md:min-w-[min(var(--size-min-w),100%)]",
      maxW && "md:max-w-[min(var(--size-max-w),100%)]",
      minH && "md:min-h-(--size-min-h)",
      maxH && "md:max-h-(--size-max-h) md:overflow-hidden"
    ),
    style: {
      ...(fixedWidth !== null ? { "--size-w": `${fixedWidth}px` } : {}),
      ...(fixedHeight !== null ? { "--size-h": `${fixedHeight}px` } : {}),
      ...(minW ? { "--size-min-w": `${minW}px` } : {}),
      ...(maxW ? { "--size-max-w": `${maxW}px` } : {}),
      ...(minH ? { "--size-min-h": `${minH}px` } : {}),
      ...(maxH ? { "--size-max-h": `${maxH}px` } : {}),
    } as CSSProperties,
    fillHeight: fillHeight && stretchChild,
  };
}

/** Children with their cells, in reading order — the order on small screens. */
function inCells<T extends { span?: number; row?: number; col?: number }>(children: T[], grid?: GridSettings) {
  const cells = layoutCells(children, gridColumns(grid).length, gridRows(grid));
  return children.map((child, i) => ({ child, cell: cells[i] })).sort((a, b) => a.cell.row - b.cell.row || a.cell.col - b.cell.col);
}

/** A section's content on the public page: its groups, each a grid of its components. */
export function SectionContent({ section, animate = false }: { section: PageSection; animate?: boolean }) {
  const outer = gridProps(section.grid);
  return (
    <div className={outer.className} style={outer.style}>
      {inCells(section.groups, section.grid).map(({ child: group, cell: groupCell }) => {
        const cell = cellProps(groupCell);
        const inner = gridProps(group.grid);
        const size = sizeProps(group.size, false, group.cellAlign);
        return (
          <div key={group.id} className={cn(cell.className, inner.className, size.className)} style={{ ...cell.style, ...inner.style, ...size.style }}>
            {inCells(group.blocks, group.grid).map(({ child: block, cell: blockCell }) => {
              const c = cellProps(blockCell);
              const s = sizeProps(block.size, true, block.cellAlign);
              return (
                <div key={block.id} className={cn("w-full", c.className, s.className)} style={{ ...c.style, ...s.style }}>
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
