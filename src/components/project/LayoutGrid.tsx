import type { CSSProperties } from "react";
import type { GridAlign, GridGap, GridSettings, PageSection } from "@/types/project";
import { cn } from "@/lib/utils";
import { gridColumns, layoutCells, type Cell } from "@/lib/projectLayout";
import { ProjectBlock } from "@/components/project/CoreBlocks";

/**
 * The grids of the page: a section lays out its groups (Blok), a group its
 * components (Bileşen). One column on small screens, in reading order; from
 * md up the set column widths (twelfths → fr), each child in its cell
 * (layoutCells: where it was put, or the next free one).
 */

const GAP_CLASS: Record<GridGap, string> = { sm: "gap-2", md: "gap-4", lg: "gap-8" };
const ALIGN_CLASS: Record<GridAlign, string> = { start: "items-start", center: "items-center", end: "items-end" };

/** Class and style of a grid container. */
export function gridProps(grid?: GridSettings): { className: string; style: CSSProperties } {
  return {
    className: cn("grid w-full grid-cols-1 md:grid-cols-(--grid-cols)", GAP_CLASS[grid?.gap ?? "md"], ALIGN_CLASS[grid?.align ?? "start"]),
    style: { "--grid-cols": gridColumns(grid).map((c) => `minmax(0,${c}fr)`).join(" ") } as CSSProperties,
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

/** Children with their cells, in reading order — the order on small screens. */
function inCells<T extends { span?: number; row?: number; col?: number }>(children: T[], grid?: GridSettings) {
  const cells = layoutCells(children, gridColumns(grid).length);
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
        return (
          <div key={group.id} className={cn(cell.className, inner.className)} style={{ ...cell.style, ...inner.style }}>
            {inCells(group.blocks, group.grid).map(({ child: block, cell: blockCell }) => {
              const c = cellProps(blockCell);
              return (
                <div key={block.id} className={cn("w-full", c.className)} style={c.style}>
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
