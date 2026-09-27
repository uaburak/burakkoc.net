import { Block, BlockEntry, ListItem, TableRow } from "@/types/project";

/**
 * Live-editing contract between the block renderers and the admin editor.
 *
 * Renderers receive the block already localized for display plus an optional
 * `BlockEditApi`. When the API is present every text field becomes inline
 * editable; the API writes back to the raw block, routing localized fields to
 * their `…En` twin when editing in English.
 */

export type Lang = "tr" | "en";

export type BlockTextKey = "content" | "subheading" | "caption" | "alt" | "title" | "authorRole" | "author";
export type EntryTextKey = "label" | "value" | "eyebrow" | "title" | "text" | "alt" | "caption" | "href";

export interface BlockEditApi {
  setText(key: BlockTextKey, value: string): void;
  setEntryText(entryId: string, key: EntryTextKey, value: string): void;
  addEntry(): void;
  removeEntry(entryId: string): void;
  moveEntry(activeId: string, overId: string): void;
  setListItemText(itemId: string, value: string): void;
  toggleListItem(itemId: string): void;
  /** Inserts an empty item after `afterId` (or at the end) and returns its id. */
  addListItem(afterId?: string): string;
  removeListItem(itemId: string): void;
  moveListItem(activeId: string, overId: string): void;
  setTableCell(rowId: string, col: number, value: string): void;
}

let _c = 0;
export function editorUid(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${(++_c).toString(36)}`;
}

const LOCALIZED_BLOCK_KEYS: ReadonlySet<BlockTextKey> = new Set(["content", "subheading", "caption", "alt", "title", "authorRole"]);
const LOCALIZED_ENTRY_KEYS: ReadonlySet<EntryTextKey> = new Set(["label", "value", "eyebrow", "title", "text", "alt", "caption"]);

/** Entry fields that hold the same value in every language (colors, percentages). */
const SHARED_ENTRY_KEYS: Partial<Record<Block["type"], ReadonlySet<EntryTextKey>>> = {
  bars: new Set(["value"]),
  palette: new Set(["value"]),
};

function move<T extends { id: string }>(list: T[], activeId: string, overId: string): T[] {
  const from = list.findIndex((x) => x.id === activeId);
  const to = list.findIndex((x) => x.id === overId);
  if (from < 0 || to < 0 || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function createBlockEditApi(raw: Block, lang: Lang, onChange: (patch: Partial<Block>) => void): BlockEditApi {
  const en = lang === "en";
  const entries = raw.entries ?? [];
  const items = raw.listItems ?? [];

  const entryKey = (key: EntryTextKey) =>
    en && LOCALIZED_ENTRY_KEYS.has(key) && !SHARED_ENTRY_KEYS[raw.type]?.has(key) ? `${key}En` : key;

  return {
    setText(key, value) {
      onChange({ [en && LOCALIZED_BLOCK_KEYS.has(key) ? `${key}En` : key]: value });
    },
    setEntryText(entryId, key, value) {
      onChange({ entries: entries.map((e) => (e.id === entryId ? { ...e, [entryKey(key)]: value } : e)) });
    },
    addEntry() {
      const entry: BlockEntry = { id: editorUid("en") };
      if (raw.type === "links") entry.icon = "web";
      if (raw.type === "bars") entry.value = "50";
      onChange({ entries: [...entries, entry] });
    },
    removeEntry(entryId) {
      onChange({ entries: entries.filter((e) => e.id !== entryId) });
    },
    moveEntry(activeId, overId) {
      onChange({ entries: move(entries, activeId, overId) });
    },
    setListItemText(itemId, value) {
      onChange({ listItems: items.map((it) => (it.id === itemId ? { ...it, [en ? "textEn" : "text"]: value } : it)) });
    },
    toggleListItem(itemId) {
      onChange({ listItems: items.map((it) => (it.id === itemId ? { ...it, checked: !it.checked } : it)) });
    },
    addListItem(afterId) {
      const item: ListItem = { id: editorUid("li"), text: "" };
      const at = afterId ? items.findIndex((it) => it.id === afterId) + 1 : items.length;
      const next = [...items];
      next.splice(at <= 0 ? items.length : at, 0, item);
      onChange({ listItems: next });
      return item.id;
    },
    removeListItem(itemId) {
      onChange({ listItems: items.filter((it) => it.id !== itemId) });
    },
    moveListItem(activeId, overId) {
      onChange({ listItems: move(items, activeId, overId) });
    },
    setTableCell(rowId, col, value) {
      const rows = raw.tableRows ?? [];
      const width = Math.max(1, ...rows.map((r) => r.cells.length));
      onChange({
        tableRows: rows.map((r): TableRow => {
          if (r.id !== rowId) return r;
          const source = en ? r.cellsEn ?? r.cells : r.cells;
          const cells = Array.from({ length: width }, (_, i) => source[i] ?? "");
          cells[col] = value;
          return en ? { ...r, cellsEn: cells } : { ...r, cells };
        }),
      });
    },
  };
}

/** Promotes the EN fields of any block (core or case-study) into the default slots. */
export function localizeBlock(block: Block, lang: Lang): Block {
  if (lang === "tr") return block;
  return {
    ...block,
    content: block.contentEn ?? block.content,
    subheading: block.subheadingEn ?? block.subheading,
    alt: block.altEn ?? block.alt,
    caption: block.captionEn ?? block.caption,
    authorRole: block.authorRoleEn ?? block.authorRole,
    title: block.titleEn ?? block.title,
    listItems: block.listItems?.map((it) => ({ ...it, text: it.textEn ?? it.text })),
    tableRows: block.tableRows?.map((r) => ({ ...r, cells: r.cellsEn ?? r.cells })),
    entries: block.entries?.map((e) => ({
      ...e,
      label: e.labelEn ?? e.label,
      value: e.valueEn ?? e.value,
      eyebrow: e.eyebrowEn ?? e.eyebrow,
      title: e.titleEn ?? e.title,
      text: e.textEn ?? e.text,
      alt: e.altEn ?? e.alt,
      caption: e.captionEn ?? e.caption,
    })),
  };
}
