import type { CSSProperties } from "react";
import type { GridAlign, GridGap, GridSettings, PageSection } from "@/types/project";
import { cn } from "@/lib/utils";
import { clampSpan, gridColumns } from "@/lib/projectLayout";
import { ProjectBlock } from "@/components/project/CoreBlocks";

/**
 * The grids of the page: a section lays out its groups (Blok), a group its
 * components (Bileşen). One column on small screens; from md up the set
 * column widths (twelfths → fr), children filling them in order.
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
 * Class and style of a child on `parent`'s grid, covering `span` of its
 * columns. Every cell sets its own `--span` (custom properties inherit).
 */
export function cellProps(span: number | undefined, parent?: GridSettings): { className: string; style: CSSProperties } {
  return {
    className: "min-w-0 md:col-span-(--span)",
    style: { "--span": clampSpan(span, gridColumns(parent).length) } as CSSProperties,
  };
}

/** A section's content on the public page: its groups, each a grid of its components. */
export function SectionContent({ section, animate = false }: { section: PageSection; animate?: boolean }) {
  const outer = gridProps(section.grid);
  return (
    <div className={outer.className} style={outer.style}>
      {section.groups.map((group) => {
        const cell = cellProps(group.span, section.grid);
        const inner = gridProps(group.grid);
        return (
          <div key={group.id} className={cn(cell.className, inner.className)} style={{ ...cell.style, ...inner.style }}>
            {group.blocks.map((block) => {
              const c = cellProps(block.span, group.grid);
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
