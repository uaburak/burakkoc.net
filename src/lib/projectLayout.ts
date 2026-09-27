import type { Block, GridSettings, Group, PageItem, PageSection } from "@/types/project";

/**
 * Page structure helpers: Bölüm (section) › Blok (group) › Bileşen (block).
 *
 * Sections and groups both lay out their children on a grid (GridSettings):
 * the grid's columns have widths in twelfths, the children fill them in order
 * and wrap to a new line; a child may cover several columns (`span`). Ids are
 * unique across the page, so groups and blocks are found by id alone.
 */

// ── Grid ──────────────────────────────────────────────────────────────────────

/** Column widths are twelfths of the row. */
export const GRID_UNITS = 12;
/** Most columns a section or group can have. */
export const MAX_COLUMNS = 6;

/** 12 spread over `n` columns as evenly as possible: 5 → 3 3 2 2 2. */
export function evenSpans(n: number): number[] {
  const count = Math.min(GRID_UNITS, Math.max(1, Math.round(n)));
  const base = Math.floor(GRID_UNITS / count);
  const extra = GRID_UNITS % count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Ready-made layouts for the common column counts. */
export const GRID_PRESETS: Record<number, number[][]> = {
  2: [[6, 6], [4, 8], [8, 4], [3, 9], [9, 3]],
  3: [[4, 4, 4], [3, 6, 3], [6, 3, 3], [3, 3, 6]],
  4: [[3, 3, 3, 3], [2, 4, 4, 2], [4, 2, 2, 4]],
};

/** The grid's column widths — one full-width column unless set. */
export function gridColumns(grid?: GridSettings): number[] {
  const columns = grid?.columns?.filter((c) => Number.isFinite(c) && c > 0);
  return columns?.length ? columns : [GRID_UNITS];
}

/** Sets how many columns the grid has; widths are spread evenly. */
export function withColumnCount(grid: GridSettings | undefined, count: number): GridSettings {
  const n = Math.min(MAX_COLUMNS, Math.max(1, Math.round(count)));
  return { ...grid, columns: evenSpans(n) };
}

/**
 * Sets one column's width; the difference goes to (or comes from) its right
 * neighbour — the left one for the last column — so the row stays at 12.
 */
export function withColumnWidth(grid: GridSettings | undefined, index: number, width: number): GridSettings {
  const columns = [...gridColumns(grid)];
  if (columns.length < 2 || index < 0 || index >= columns.length) return { ...grid, columns };
  const neighbour = index < columns.length - 1 ? index + 1 : index - 1;
  const pair = columns[index] + columns[neighbour];
  const next = Math.min(pair - 1, Math.max(1, Math.round(width)));
  columns[index] = next;
  columns[neighbour] = pair - next;
  return { ...grid, columns };
}

/** How many columns a child covers, within the grid it sits on. */
export function clampSpan(span: number | undefined, columnCount: number) {
  return Math.min(columnCount, Math.max(1, Math.round(span ?? 1)));
}

/** "4·8" — a layout's name. */
export const layoutName = (columns: number[]) => columns.join("·");

// ── Reading the tree ──────────────────────────────────────────────────────────

export const sectionsOf = (items: PageItem[]) => items.filter((i): i is PageSection => i.kind === "section");

/** Every component of a section, in reading order. */
export function sectionBlocks(section: Pick<PageSection, "groups">): Block[] {
  return (section.groups ?? []).flatMap((g) => g.blocks ?? []);
}

export function findSection(items: PageItem[], sectionId: string) {
  return sectionsOf(items).find((s) => s.id === sectionId) ?? null;
}

export function findGroup(items: PageItem[], groupId: string): { section: PageSection; group: Group; index: number } | null {
  for (const section of sectionsOf(items)) {
    const index = section.groups.findIndex((g) => g.id === groupId);
    if (index >= 0) return { section, group: section.groups[index], index };
  }
  return null;
}

export function findBlock(items: PageItem[], blockId: string): { section: PageSection; group: Group; block: Block; index: number } | null {
  for (const section of sectionsOf(items)) {
    for (const group of section.groups) {
      const index = group.blocks.findIndex((b) => b.id === blockId);
      if (index >= 0) return { section, group, block: group.blocks[index], index };
    }
  }
  return null;
}

// ── Rewriting the tree (same arrays where nothing changed) ────────────────────

export function mapSection(items: PageItem[], sectionId: string, fn: (s: PageSection) => PageSection): PageItem[] {
  let changed = false;
  const next = items.map((i) => {
    if (i.kind !== "section" || i.id !== sectionId) return i;
    const s = fn(i);
    if (s !== i) changed = true;
    return s;
  });
  return changed ? next : items;
}

export function mapGroup(items: PageItem[], groupId: string, fn: (g: Group) => Group): PageItem[] {
  const at = findGroup(items, groupId);
  if (!at) return items;
  return mapSection(items, at.section.id, (s) => ({ ...s, groups: s.groups.map((g) => (g.id === groupId ? fn(g) : g)) }));
}

export function mapBlock(items: PageItem[], blockId: string, fn: (b: Block) => Block): PageItem[] {
  const at = findBlock(items, blockId);
  if (!at) return items;
  return mapGroup(items, at.group.id, (g) => ({ ...g, blocks: g.blocks.map((b) => (b.id === blockId ? fn(b) : b)) }));
}

function insertBefore<T extends { id: string }>(list: T[], item: T, beforeId: string | null): T[] {
  const next = [...list];
  const at = beforeId ? next.findIndex((x) => x.id === beforeId) : -1;
  next.splice(at < 0 ? next.length : at, 0, item);
  return next;
}

/** Moves a block into another group, before `beforeBlockId` (or at its end). */
export function moveBlockToGroup(items: PageItem[], blockId: string, toGroupId: string, beforeBlockId: string | null): PageItem[] {
  const from = findBlock(items, blockId);
  if (!from || from.group.id === toGroupId || !findGroup(items, toGroupId)) return items;
  const removed = mapGroup(items, from.group.id, (g) => ({ ...g, blocks: g.blocks.filter((b) => b.id !== blockId) }));
  return mapGroup(removed, toGroupId, (g) => ({ ...g, blocks: insertBefore(g.blocks, from.block, beforeBlockId) }));
}

/** Moves a group into another section, before `beforeGroupId` (or at its end). */
export function moveGroupToSection(items: PageItem[], groupId: string, toSectionId: string, beforeGroupId: string | null): PageItem[] {
  const from = findGroup(items, groupId);
  if (!from || from.section.id === toSectionId || !findSection(items, toSectionId)) return items;
  const removed = mapSection(items, from.section.id, (s) => ({ ...s, groups: s.groups.filter((g) => g.id !== groupId) }));
  return mapSection(removed, toSectionId, (s) => ({ ...s, groups: insertBefore(s.groups, from.group, beforeGroupId) }));
}

// ── Stored data → current shape ───────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Blocks of an old "İç Bölüm" (row) block come out in reading order. */
function flattenLegacyBlocks(blocks: any[]): Block[] {
  return blocks.flatMap((b: any) =>
    b?.type === "row" ? (Array.isArray(b.rowColumns) ? b.rowColumns : []).flatMap((c: any) => flattenLegacyBlocks(Array.isArray(c?.blocks) ? c.blocks : [])) : [b]
  );
}

/**
 * A stored section in the current shape. Sections saved before groups existed
 * hold their components directly (`blocks`): they become one full-width group,
 * which looks exactly like before on the page.
 */
export function normalizeSection(raw: any): PageSection {
  const id = String(raw?.id || Math.random().toString(36).slice(2, 10));
  const groups: Group[] = Array.isArray(raw?.groups)
    ? raw.groups.map((g: any, i: number) => ({
        ...g,
        id: String(g?.id || `${id}-g${i + 1}`),
        blocks: Array.isArray(g?.blocks) ? g.blocks : [],
      }))
    : Array.isArray(raw?.blocks)
      ? [{ id: `${id}-g1`, blocks: flattenLegacyBlocks(raw.blocks) }]
      : [];
  const { blocks: _legacy, ...rest } = raw ?? {};
  void _legacy;
  return { ...rest, id, kind: "section", groups };
}

/** Page items in the current shape (anything that isn't a divider is a section). */
export function normalizeItems(items: any[]): PageItem[] {
  return items.map((item: any) => (item?.kind === "divider" ? { id: String(item.id), kind: "divider" } : normalizeSection(item)));
}

/* eslint-enable @typescript-eslint/no-explicit-any */
