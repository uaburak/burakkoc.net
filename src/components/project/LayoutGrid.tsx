import type { CSSProperties } from "react";
import type { Block, CellAlign, CellFit, GridGap, GridSettings, Group, PageSection } from "@/types/project";
import { cn } from "@/lib/utils";
import { cellSizing, cellWidth, gridColumns, gridPadding, layoutCells, type Cell } from "@/lib/projectLayout";
import { ProjectBlock } from "@/components/project/CoreBlocks";

/**
 * The grids of the page: a section lays out its groups (Blok), a group its
 * components (Bileşen). One column on small screens, in reading order; from
 * md up the set column widths (twelfths → fr), each child in its cell
 * (layoutCells: where it was put, or the next free one), placed inside it as
 * set (cellProps).
 */

const GAP_CLASS: Record<GridGap, string> = { sm: "gap-2", md: "gap-4", lg: "gap-8" };
/** Inside its cell: left / centre / right (when narrower than it) … */
const JUSTIFY_CLASS: Record<CellAlign, string> = { start: "justify-self-start", center: "justify-self-center", end: "justify-self-end" };
/** … and top / middle / bottom (when a neighbour on its row is taller). */
const SELF_CLASS: Record<CellAlign, string> = { start: "self-start", center: "self-center", end: "self-end" };

/** Class and style of a grid container (its width is up to the caller). */
export function gridProps(grid?: GridSettings): { className: string; style: CSSProperties } {
  const padding = gridPadding(grid);
  return {
    className: cn("grid grid-cols-1 md:grid-cols-(--grid-cols)", GAP_CLASS[grid?.gap ?? "md"]),
    style: { "--grid-cols": gridColumns(grid).map((c) => `minmax(0,${c}fr)`).join(" "), ...(padding ? { padding } : {}) } as CSSProperties,
  };
}

/**
 * Class and style of a child in its cell of the grid (from md up). Every cell
 * sets its own `--row`, `--col` and `--span` (custom properties inherit).
 * With `fit` (a Blok or component) it also takes its place inside the cell:
 * its width (fill / hug / fixed — never wider than the cell) and alignment.
 */
export function cellProps(cell: Cell, fit?: CellFit & (Pick<Block, "type"> | Pick<Group, "blocks">)): { className: string; style: CSSProperties } {
  const place = { "--row": cell.row, "--col": cell.col, "--span": cell.span } as CSSProperties;
  const className = "min-w-0 md:[grid-row:var(--row)] md:[grid-column:var(--col)/span_var(--span)]";
  if (!fit) return { className, style: place };
  const sizing = cellSizing(fit);
  return {
    className: cn(
      className,
      SELF_CLASS[fit.alignY ?? "start"],
      sizing === "fill" ? "w-full" : cn("max-w-full", JUSTIFY_CLASS[fit.alignX ?? "start"], sizing === "hug" && "w-fit")
    ),
    style: sizing === "fixed" ? { ...place, width: cellWidth(fit) } : place,
  };
}

/** Children with their cells, in reading order — the order on small screens. */
function inCells<T extends { span?: number; row?: number; col?: number }>(children: T[], grid?: GridSettings) {
  const cells = layoutCells(children, gridColumns(grid).length);
  return children.map((child, i) => ({ child, cell: cells[i] })).sort((a, b) => a.cell.row - b.cell.row || a.cell.col - b.cell.col);
}

/** A section's content on the public page: its groups, each a grid of its components. */
export function SectionContent({ section, animate = false }: { section: PageSection; animate?: boolean }) {
  const outer = gridProps(section.grid);
  return (
    <div className={cn("w-full", outer.className)} style={outer.style}>
      {inCells(section.groups, section.grid).map(({ child: group, cell: groupCell }) => {
        const cell = cellProps(groupCell, group);
        const inner = gridProps(group.grid);
        return (
          <div key={group.id} className={cn(cell.className, inner.className)} style={{ ...cell.style, ...inner.style }}>
            {inCells(group.blocks, group.grid).map(({ child: block, cell: blockCell }) => {
              const c = cellProps(blockCell, block);
              return (
                <div key={block.id} className={c.className} style={c.style}>
                  <ProjectBlock block={block} animate={animate} />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
