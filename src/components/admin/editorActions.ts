import { useMemo, type Dispatch, type SetStateAction } from "react";
import { Block, BlockType, PageItem, PageSection, ProjectData, Section } from "@/types/project";
import { makeBlock, makeDivider, makeSection, uid } from "@/components/admin/blockCatalog";

/**
 * Every project mutation the form and the live editor perform. All updates are
 * functional so rapid edits (typing, dragging) never overwrite each other.
 */

export type ProjectMeta = Pick<ProjectData,
  "title" | "titleEn" | "category" | "year" | "company" | "slug" | "coverImage" | "description" | "descriptionEn" | "theme">;

/** Copy of a block with fresh ids for the block and all its rows. */
function cloneBlock(block: Block): Block {
  const copy: Block = structuredClone(block);
  copy.id = uid();
  copy.entries = copy.entries?.map((e) => ({ ...e, id: uid() }));
  copy.listItems = copy.listItems?.map((it) => ({ ...it, id: uid() }));
  copy.tableRows = copy.tableRows?.map((r) => ({ ...r, id: uid() }));
  return copy;
}

function moveBy<T>(list: T[], index: number, delta: number): T[] {
  const to = index + delta;
  if (index < 0 || to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(to, 0, item);
  return next;
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

    const mapSection = (sectionId: string, fn: (s: PageSection) => PageSection) =>
      setItems((items) => items.map((i) => (i.kind === "section" && i.id === sectionId ? fn(i) : i)));

    return {
      setItems,

      updateMeta(updates: Partial<ProjectMeta>) {
        setProject((p) => ({ ...p, ...updates }));
      },

      updateSection(sectionId: string, updates: Partial<Section>) {
        mapSection(sectionId, (s) => ({ ...s, ...updates }));
      },

      updateBlock(sectionId: string, blockId: string, patch: Partial<Block>) {
        mapSection(sectionId, (s) => ({ ...s, blocks: s.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)) }));
      },

      /** Adds a block after `afterBlockId` (or at the end) and returns its id. */
      addBlock(sectionId: string, type: BlockType, extras?: Partial<Block>, afterBlockId?: string) {
        const block = makeBlock(type, extras);
        mapSection(sectionId, (s) => ({ ...s, blocks: insertAfter(s.blocks, block, afterBlockId) }));
        return block.id;
      },

      /** Global "Ekle → Blok": appends to the last section, creating one after a trailing divider. */
      addBlockToEnd(type: BlockType, extras?: Partial<Block>) {
        const block = makeBlock(type, extras);
        setItems((items) => {
          const last = items[items.length - 1];
          if (!last || last.kind === "divider") return [...items, { ...makeSection(), blocks: [block] }];
          return items.map((i, idx) => (idx === items.length - 1 && i.kind === "section" ? { ...i, blocks: [...i.blocks, block] } : i));
        });
        return block.id;
      },

      deleteBlock(sectionId: string, blockId: string) {
        mapSection(sectionId, (s) => ({ ...s, blocks: s.blocks.filter((b) => b.id !== blockId) }));
      },

      duplicateBlock(sectionId: string, block: Block) {
        const copy = cloneBlock(block);
        mapSection(sectionId, (s) => ({ ...s, blocks: insertAfter(s.blocks, copy, block.id) }));
        return copy.id;
      },

      moveBlockBy(sectionId: string, blockId: string, delta: number) {
        mapSection(sectionId, (s) => ({ ...s, blocks: moveBy(s.blocks, s.blocks.findIndex((b) => b.id === blockId), delta) }));
      },

      /** Adds a section after `afterItemId` (or at the end) and returns its id. */
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
    };
  }, [setProject]);
}

export type EditorActions = ReturnType<typeof useEditorActions>;
