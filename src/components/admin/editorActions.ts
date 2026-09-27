import { useMemo, type Dispatch, type SetStateAction } from "react";
import { Block, BlockType, GridAlign, GridSettings, Group, PageItem, PageSection, ProjectData } from "@/types/project";
import { makeBlock, makeDivider, makeGroup, makeSection, uid } from "@/components/admin/blockCatalog";
import { findBlock, findGroup, gridColumns, gridRows, placedByHand, mapBlock, mapGroup, mapSection, placeBlock, placeGroup, swapBlocks, swapCells, swapGroups } from "@/lib/projectLayout";

/**
 * Every project mutation the form and the live editor perform. All updates are
 * functional so rapid edits (typing, dragging) never overwrite each other.
 *
 * The page is Bölüm (section) › Blok (group) › Bileşen (component, `Block` in
 * code). Ids are unique across the page, so groups and components are
 * addressed by id alone.
 */

export type ProjectMeta = Pick<ProjectData,
  "title" | "titleEn" | "category" | "year" | "company" | "slug" | "coverImage" | "description" | "descriptionEn" | "theme">;

/** Copy of a component with fresh ids for it and all its rows. */
function cloneBlock(block: Block): Block {
  const copy: Block = structuredClone(block);
  copy.id = uid();
  copy.entries = copy.entries?.map((e) => ({ ...e, id: uid() }));
  copy.listItems = copy.listItems?.map((it) => ({ ...it, id: uid() }));
  copy.tableRows = copy.tableRows?.map((r) => ({ ...r, id: uid() }));
  return copy;
}

/** Copy of a group with fresh ids for it and its components. */
function cloneGroup(group: Group): Group {
  return { ...structuredClone(group), id: uid(), blocks: group.blocks.map(cloneBlock) };
}

function moveBy<T>(list: T[], index: number, delta: number): T[] {
  const to = index + delta;
  if (index < 0 || to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * One step earlier / later: in a grid laid out by hand (the list is in
 * reading order) it swaps cells with that neighbour, otherwise (a stack, or
 * a grid filled in order) it moves in the list.
 */
function stepBy<T extends { id: string; span?: number; row?: number; col?: number }>(list: T[], index: number, delta: number, grid: GridSettings | undefined): T[] {
  if (!placedByHand(grid, list)) return moveBy(list, index, delta);
  const other = list[index + delta];
  return other ? swapCells(list, list[index].id, other.id, gridColumns(grid).length, gridRows(grid)) : list;
}

function insertAfter<T extends { id: string }>(list: T[], item: T, afterId?: string): T[] {
  const at = afterId ? list.findIndex((x) => x.id === afterId) : -1;
  const next = [...list];
  next.splice(at < 0 ? list.length : at + 1, 0, item);
  return next;
}

export function useEditorActions(setProject: Dispatch<SetStateAction<ProjectData>>) {
  return useMemo(() => {
    const setItems = (update: (items: PageItem[]) => PageItem[]) =>
      setProject((p) => {
        const next = update(p.items);
        return next === p.items ? p : { ...p, items: next };
      });

    return {
      setItems,

      updateMeta(updates: Partial<ProjectMeta>) {
        setProject((p) => ({ ...p, ...updates }));
      },

      // ── Sections & dividers ──

      updateSection(sectionId: string, patch: Partial<Omit<PageSection, "id" | "kind">>) {
        setItems((items) => mapSection(items, sectionId, (s) => ({ ...s, ...patch })));
      },

      /** Adds a section (with an empty Blok) after `afterItemId` (or at the end) and returns its id. */
      addSection(afterItemId?: string) {
        const section = makeSection();
        setItems((items) => insertAfter(items, section, afterItemId));
        return section.id;
      },

      addDivider(afterItemId?: string) {
        const divider = makeDivider();
        setItems((items) => insertAfter(items, divider, afterItemId));
      },

      deleteItem(itemId: string) {
        setItems((items) => items.filter((i) => i.id !== itemId));
      },

      moveItemBy(itemId: string, delta: number) {
        setItems((items) => moveBy(items, items.findIndex((i) => i.id === itemId), delta));
      },

      // ── Groups (Blok) ──

      /** Adds an empty group after `afterGroupId` (or at the section's end) and returns its id. */
      addGroup(sectionId: string, afterGroupId?: string) {
        const group = makeGroup();
        setItems((items) => mapSection(items, sectionId, (s) => ({ ...s, groups: insertAfter(s.groups, group, afterGroupId) })));
        return group.id;
      },

      updateGroup(groupId: string, patch: Partial<Omit<Group, "id" | "blocks">>) {
        setItems((items) => mapGroup(items, groupId, (g) => ({ ...g, ...patch })));
      },

      deleteGroup(groupId: string) {
        setItems((items) => {
          const at = findGroup(items, groupId);
          return at ? mapSection(items, at.section.id, (s) => ({ ...s, groups: s.groups.filter((g) => g.id !== groupId) })) : items;
        });
      },

      duplicateGroup(groupId: string) {
        const id = uid();
        setItems((items) => {
          const at = findGroup(items, groupId);
          if (!at) return items;
          const copy = { ...cloneGroup(at.group), id };
          return mapSection(items, at.section.id, (s) => ({ ...s, groups: insertAfter(s.groups, copy, groupId) }));
        });
        return id;
      },

      /** Puts a Blok in a free cell of a section's grid; the others keep their cells. */
      placeGroup(groupId: string, sectionId: string, row: number, col: number) {
        setItems((items) => placeGroup(items, groupId, sectionId, row, col));
      },

      /**
       * Where a section's content sits in it (Figma's alignment box): across
       * and down. Its Bloks' own alignment is cleared, so this one shows.
       */
      alignSection(sectionId: string, justify: GridAlign, align: GridAlign) {
        setItems((items) =>
          mapSection(items, sectionId, (s) => ({
            ...s,
            grid: { ...s.grid, justify, align },
            groups: s.groups.map(({ cellAlign: _own, ...g }) => (void _own, g)),
          }))
        );
      },

      /** Swaps the cells of two Bloks of a section. */
      swapGroups(sectionId: string, aId: string, bId: string) {
        setItems((items) => swapGroups(items, sectionId, aId, bId));
      },

      moveGroupBy(groupId: string, delta: number) {
        setItems((items) => {
          const at = findGroup(items, groupId);
          return at ? mapSection(items, at.section.id, (s) => ({ ...s, groups: stepBy(s.groups, at.index, delta, s.grid) })) : items;
        });
      },

      // ── Components (Bileşen) ──

      updateBlock(blockId: string, patch: Partial<Block>) {
        setItems((items) => mapBlock(items, blockId, (b) => ({ ...b, ...patch })));
      },

      /** Adds a component to a group — after `afterBlockId`, else at its end — and returns its id. */
      addBlock(groupId: string, type: BlockType, extras?: Partial<Block>, afterBlockId?: string) {
        const block = makeBlock(type, extras);
        setItems((items) => mapGroup(items, groupId, (g) => ({ ...g, blocks: insertAfter(g.blocks, block, afterBlockId) })));
        return block.id;
      },

      /** Adds a component at the end of a section's last group (a new one if it has none); returns its id. */
      addBlockToSection(sectionId: string, type: BlockType, extras?: Partial<Block>) {
        const block = makeBlock(type, extras);
        setItems((items) =>
          mapSection(items, sectionId, (s) => {
            const last = s.groups[s.groups.length - 1];
            if (!last) return { ...s, groups: [makeGroup([block])] };
            return { ...s, groups: s.groups.map((g) => (g === last ? { ...g, blocks: [...g.blocks, block] } : g)) };
          })
        );
        return block.id;
      },

      /** Global "Ekle → Bileşen": appends to the last section, creating one after a trailing divider. */
      addBlockToEnd(type: BlockType, extras?: Partial<Block>) {
        const block = makeBlock(type, extras);
        setItems((items) => {
          const last = items[items.length - 1];
          if (!last || last.kind === "divider") return [...items, makeSection([block])];
          return mapSection(items, last.id, (s) => {
            const lastGroup = s.groups[s.groups.length - 1];
            if (!lastGroup) return { ...s, groups: [makeGroup([block])] };
            return { ...s, groups: s.groups.map((g) => (g === lastGroup ? { ...g, blocks: [...g.blocks, block] } : g)) };
          });
        });
        return block.id;
      },

      /** Global "Ekle → Blok": an empty group at the end of the last section (or a new section). */
      addGroupToEnd() {
        const group = makeGroup();
        setItems((items) => {
          const last = items[items.length - 1];
          if (!last || last.kind === "divider") return [...items, { ...makeSection(), groups: [group] }];
          return mapSection(items, last.id, (s) => ({ ...s, groups: [...s.groups, group] }));
        });
        return group.id;
      },

      deleteBlock(blockId: string) {
        setItems((items) => {
          const at = findBlock(items, blockId);
          return at ? mapGroup(items, at.group.id, (g) => ({ ...g, blocks: g.blocks.filter((b) => b.id !== blockId) })) : items;
        });
      },

      duplicateBlock(block: Block) {
        const copy = cloneBlock(block);
        setItems((items) => {
          const at = findBlock(items, block.id);
          return at ? mapGroup(items, at.group.id, (g) => ({ ...g, blocks: insertAfter(g.blocks, copy, block.id) })) : items;
        });
        return copy.id;
      },

      /** Puts a component in a free cell of a Blok's grid; the others keep their cells. */
      placeBlock(blockId: string, groupId: string, row: number, col: number) {
        setItems((items) => placeBlock(items, blockId, groupId, row, col));
      },

      /** The same for a Blok and its components. */
      alignGroup(groupId: string, justify: GridAlign, align: GridAlign) {
        setItems((items) =>
          mapGroup(items, groupId, (g) => ({
            ...g,
            grid: { ...g.grid, justify, align },
            blocks: g.blocks.map(({ cellAlign: _own, ...b }) => (void _own, b)),
          }))
        );
      },

      /** Swaps the cells of two components of a Blok. */
      swapBlocks(groupId: string, aId: string, bId: string) {
        setItems((items) => swapBlocks(items, groupId, aId, bId));
      },

      moveBlockBy(blockId: string, delta: number) {
        setItems((items) => {
          const at = findBlock(items, blockId);
          return at ? mapGroup(items, at.group.id, (g) => ({ ...g, blocks: stepBy(g.blocks, at.index, delta, g.grid) })) : items;
        });
      },
    };
  }, [setProject]);
}

export type EditorActions = ReturnType<typeof useEditorActions>;
