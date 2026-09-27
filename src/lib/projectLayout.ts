import type { Block, GridSettings, Group, PageItem, PageSection } from "@/types/project";

/**
 * Page structure helpers: Bölüm (section) › Blok (group) › Bileşen (block).
 *
 * Sections and groups both lay out their children on a grid (GridSettings):
 * the grid's columns have widths in twelfths; it has as many rows as set
 * (`rows`), more when its children need them. A child put in a cell (`row` /
 * `col`) stays there — the cells around it may stay empty; the others fill
 * the free cells in order, wrapping to a new row.
 * A child may cover several columns (`span`). Ids are unique across the page,
 * so groups and blocks are found by id alone.
 */

// ── Grid ──────────────────────────────────────────────────────────────────────

/** Column widths are twelfths of the row. */
export const GRID_UNITS = 12;
/** Most columns a section or group can have: one twelfth each. */
export const MAX_COLUMNS = GRID_UNITS;

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

/** Most rows a grid can be set to have (its children may still need more). */
export const MAX_ROWS = 12;

/**
 * How many rows the grid was set to have — 0 when unset. Those rows stay
 * where they are even when empty; the rows after them close up when empty.
 */
export function gridRows(grid?: GridSettings): number {
  const rows = Number(grid?.rows);
  return Number.isFinite(rows) && rows >= 1 ? Math.min(MAX_ROWS, Math.round(rows)) : 0;
}

/** Was a grid assigned — more than one column, or a row count set? */
export function hasGrid(grid?: GridSettings) {
  return gridColumns(grid).length > 1 || gridRows(grid) > 0;
}

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

/** How many columns a child covers, within the grid it sits on — up to the row's end from column `col`. */
export function clampSpan(span: number | undefined, columnCount: number, col = 1) {
  return Math.min(columnCount - col + 1, Math.max(1, Math.round(span ?? 1)));
}

/** "4·8" — a layout's name. */
export const layoutName = (columns: number[]) => columns.join("·");

// ── Cells ─────────────────────────────────────────────────────────────────────

/** Where a child sits on its grid: its row and first column (1-based), and how many columns it covers. */
export interface Cell {
  row: number;
  col: number;
  span: number;
}

/** A Blok or component, as far as the grid is concerned. */
type Placeable = { id: string; span?: number; row?: number; col?: number };

const cellKey = (row: number, col: number) => `${row}:${col}`;

function takenCells(cells: Cell[]) {
  return new Set(cells.flatMap((c) => Array.from({ length: c.span }, (_, k) => cellKey(c.row, c.col + k))));
}

/**
 * Rows without any child close up — except the grid's first `rows` rows
 * (see gridRows), which stay where they are.
 */
function closeRows<T extends { row: number }>(cells: T[], rows: number): T[] {
  const after = [...new Set(cells.map((c) => c.row).filter((r) => r > rows))].sort((a, b) => a - b);
  return cells.map((c) => (c.row <= rows ? c : { ...c, row: rows + after.indexOf(c.row) + 1 }));
}

/**
 * Where each child sits on a grid of `count` columns. A child put in a cell
 * (`row` + `col`) sits right there; the others fill the free cells in order,
 * left to right and top to bottom. Rows without any child close up, after
 * the grid's first `rows` (see gridRows).
 */
export function layoutCells(children: Omit<Placeable, "id">[], count: number, rows = 0): Cell[] {
  const taken = new Set<string>();
  const fits = (row: number, col: number, span: number) =>
    col + span - 1 <= count && Array.from({ length: span }, (_, k) => cellKey(row, col + k)).every((k) => !taken.has(k));
  const take = (cell: Cell) => {
    for (let k = 0; k < cell.span; k++) taken.add(cellKey(cell.row, cell.col + k));
    return cell;
  };

  // Children in a cell first — one that overlaps another (after the column count shrank) joins the rest.
  const placed = children.map((child) => {
    if (!child.row || !child.col || !Number.isFinite(child.row) || !Number.isFinite(child.col)) return null;
    const col = Math.min(count, Math.max(1, Math.round(child.col)));
    const cell = { row: Math.max(1, Math.round(child.row)), col, span: clampSpan(child.span, count, col) };
    return fits(cell.row, cell.col, cell.span) ? take(cell) : null;
  });

  let row = 1;
  let col = 1;
  const cells = children.map((child, i) => {
    const fixed = placed[i];
    if (fixed) return fixed;
    const span = clampSpan(child.span, count);
    while (!fits(row, col, span)) {
      col++;
      if (col + span - 1 > count) {
        col = 1;
        row++;
      }
    }
    const cell = take({ row, col, span });
    col += span;
    return cell;
  });

  return closeRows(cells, rows);
}

/** How many rows a grid laid out as `cells` shows: at least its set `rows`, one more for a new line when `newRow`. */
export function rowCount(cells: Cell[], rows: number, newRow = false) {
  const used = Math.max(0, ...cells.map((c) => c.row));
  return Math.max(rows, used) + (newRow ? 1 : 0);
}

/** The grid's free cells, row by row, in its first `rows` rows — by default those of one more row too, for a new line. */
export function freeCells(cells: Cell[], count: number, rows = rowCount(cells, 0, true)): { row: number; col: number }[] {
  const taken = takenCells(cells);
  const free: { row: number; col: number }[] = [];
  for (let row = 1; row <= rows; row++) {
    for (let col = 1; col <= count; col++) if (!taken.has(cellKey(row, col))) free.push({ row, col });
  }
  return free;
}

/**
 * How many columns child `index` can cover from `col` in `row` before the next
 * taken cell (or the row's end) — 0 when that cell is taken.
 */
export function roomAt(cells: Cell[], index: number, row: number, col: number, count: number) {
  const taken = takenCells(cells.filter((_, i) => i !== index));
  let room = 0;
  while (col + room <= count && !taken.has(cellKey(row, col + room))) room++;
  return room;
}

/** Every child keeps the cell it is in, the list in reading order (the order on small screens). */
function pinCells<T extends Placeable>(children: T[], count: number, rows: number, update?: (child: T, cell: Cell, i: number) => Cell): T[] {
  const cells = layoutCells(children, count, rows);
  return children
    .map((child, i) => {
      const cell = update ? update(child, cells[i], i) : cells[i];
      return { ...child, row: cell.row, col: cell.col, span: cell.span };
    })
    .sort((a, b) => a.row - b.row || a.col - b.col);
}

/**
 * Puts child `id` in the free cell at `row` / `col` — covering as many of its
 * columns as fit there. Every other child keeps its cell. `rows`: the grid's
 * set rows (see gridRows).
 */
export function placeInCell<T extends Placeable>(children: T[], id: string, row: number, col: number, count: number, rows = 0): T[] {
  const index = children.findIndex((c) => c.id === id);
  if (index < 0) return children;
  const cells = layoutCells(children, count, rows);
  const room = roomAt(cells, index, row, col, count);
  if (room === 0) return children;
  const next = pinCells(children, count, rows, (_, cell, i) => (i === index ? { row, col, span: Math.min(cell.span, room) } : cell));
  // Rows left empty close up.
  return closeRows(next.map((c) => ({ ...c, row: c.row! })), rows);
}

/** Swaps the cells of two children (each keeps its width where it fits). `rows`: the grid's set rows. */
export function swapCells<T extends Placeable>(children: T[], aId: string, bId: string, count: number, rows = 0): T[] {
  const a = children.findIndex((c) => c.id === aId);
  const b = children.findIndex((c) => c.id === bId);
  if (a < 0 || b < 0 || a === b) return children;
  const cells = layoutCells(children, count, rows);
  const swapped = cells.map((cell, i) => (i === a ? { ...cells[b], span: cell.span } : i === b ? { ...cells[a], span: cell.span } : cell));
  return pinCells(children, count, rows, (_, __, i) => {
    const cell = swapped[i];
    if (i !== a && i !== b) return cell;
    return { ...cell, span: Math.max(1, Math.min(cell.span, roomAt(swapped, i, cell.row, cell.col, count))) };
  });
}

/** Does any child sit in a cell it was put in (the grid is laid out by hand)? */
export function hasPlacedCells(children: Omit<Placeable, "id">[]) {
  return children.some((c) => c.row != null && c.col != null);
}

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
  // Its cell belonged to the old grid: it takes the next free one in the new.
  const block = { ...from.block, row: undefined, col: undefined };
  return mapGroup(removed, toGroupId, (g) => ({ ...g, blocks: insertBefore(g.blocks, block, beforeBlockId) }));
}

/** Moves a group into another section, before `beforeGroupId` (or at its end). */
export function moveGroupToSection(items: PageItem[], groupId: string, toSectionId: string, beforeGroupId: string | null): PageItem[] {
  const from = findGroup(items, groupId);
  if (!from || from.section.id === toSectionId || !findSection(items, toSectionId)) return items;
  const removed = mapSection(items, from.section.id, (s) => ({ ...s, groups: s.groups.filter((g) => g.id !== groupId) }));
  const group = { ...from.group, row: undefined, col: undefined };
  return mapSection(removed, toSectionId, (s) => ({ ...s, groups: insertBefore(s.groups, group, beforeGroupId) }));
}

/** Puts a component in a free cell of a Blok's grid (moving it there from another Blok if need be). */
export function placeBlock(items: PageItem[], blockId: string, groupId: string, row: number, col: number): PageItem[] {
  const moved = moveBlockToGroup(items, blockId, groupId, null);
  return mapGroup(moved, groupId, (g) => ({ ...g, blocks: placeInCell(g.blocks, blockId, row, col, gridColumns(g.grid).length, gridRows(g.grid)) }));
}

/** Puts a Blok in a free cell of a section's grid (moving it there from another section if need be). */
export function placeGroup(items: PageItem[], groupId: string, sectionId: string, row: number, col: number): PageItem[] {
  const moved = moveGroupToSection(items, groupId, sectionId, null);
  return mapSection(moved, sectionId, (s) => ({ ...s, groups: placeInCell(s.groups, groupId, row, col, gridColumns(s.grid).length, gridRows(s.grid)) }));
}

/** Swaps the cells of two Bloks of a section. */
export function swapGroups(items: PageItem[], sectionId: string, aId: string, bId: string): PageItem[] {
  return mapSection(items, sectionId, (s) => ({ ...s, groups: swapCells(s.groups, aId, bId, gridColumns(s.grid).length, gridRows(s.grid)) }));
}

/** Swaps the cells of two components of a Blok. */
export function swapBlocks(items: PageItem[], groupId: string, aId: string, bId: string): PageItem[] {
  return mapGroup(items, groupId, (g) => ({ ...g, blocks: swapCells(g.blocks, aId, bId, gridColumns(g.grid).length, gridRows(g.grid)) }));
}

/**
 * Puts a component straight in a free cell of a section's grid: its Blok goes
 * there when it holds nothing else, otherwise a new Blok (`newGroupId`) is
 * made there for it.
 */
export function placeBlockInSection(items: PageItem[], blockId: string, sectionId: string, row: number, col: number, newGroupId: string): PageItem[] {
  const from = findBlock(items, blockId);
  if (!from) return items;
  if (from.group.blocks.length === 1) return placeGroup(items, from.group.id, sectionId, row, col);
  const removed = mapGroup(items, from.group.id, (g) => ({ ...g, blocks: g.blocks.filter((b) => b.id !== blockId) }));
  const added = mapSection(removed, sectionId, (s) => ({ ...s, groups: [...s.groups, { id: newGroupId, blocks: [{ ...from.block, row: undefined, col: undefined }] }] }));
  return placeGroup(added, newGroupId, sectionId, row, col);
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
