import type { BlockType, CellAlign, GridSettings, ItemTextField, Sizing } from "@/types/project";
import type { DesignComponent, FrameLook, SpacingKey, VariableValue } from "@/types/design";

/**
 * The design system as stored before components (the atomic-design branch):
 * molecules (a frame holding atoms, each in a slot) and a main component per
 * type (its frame, and the molecule its items are) — read, never written, so
 * that branch keeps its data. The first load turns them into components (see
 * componentsFromLegacy); saving stores those apart (loadDesignComponents).
 */

/** A slot of a molecule: the item's text it shows and the atom (text style) giving it its look. */
interface LegacySlot {
  field: ItemTextField;
  name: string;
  atom?: string;
  size?: Sizing;
  align?: CellAlign;
  opacity?: number;
}

/** A molecule — its first stored shape had its fill as a `background` colour. */
export interface LegacyMolecule extends FrameLook {
  id: string;
  name: string;
  layout: GridSettings;
  spacing?: Partial<Record<SpacingKey, string>>;
  radius?: VariableValue;
  background?: VariableValue;
  slots: LegacySlot[];
}

/** A type's main component: its frame, its items' molecule — and, from before molecules, their layout and texts. */
interface LegacyDesign {
  layout?: GridSettings;
  item?: { molecule?: string; size?: Sizing; layout?: GridSettings };
  texts?: Partial<Record<ItemTextField, { atom?: string; size?: Sizing; align?: CellAlign }>>;
}

export type LegacyDesigns = Partial<Record<BlockType, LegacyDesign>>;

/** The molecule every legacy design started from: the Proje Künyesi's card. */
const LEGACY_CARD: LegacyMolecule = {
  id: "card",
  name: "Kart",
  layout: { flow: "vertical", paddingX: 16, paddingY: 12, rowGap: 2 },
  radius: { alias: "radius-card" },
  fill: { color: { alias: "bg-4" } },
  slots: [
    { field: "label", name: "Etiket", atom: "label" },
    { field: "value", name: "Değer", atom: "value" },
  ],
};

/** The page components that had a main component, and the component each became. */
const PAGE_COMPONENTS: Partial<Record<BlockType, { id: string; name: string }>> = { info: { id: "project-info", name: "Proje Künyesi" } };

/** A molecule as a component: its frame and look, its slots as text layers. */
function fromMolecule({ background, slots, ...molecule }: LegacyMolecule): DesignComponent {
  return {
    ...molecule,
    fill: molecule.fill ?? (background ? { color: background } : undefined),
    layers: slots.map((slot) => ({
      kind: "text",
      id: slot.field,
      name: slot.name,
      field: slot.field,
      style: slot.atom,
      size: slot.size,
      align: slot.align,
      opacity: slot.opacity,
    })),
  };
}

/**
 * The components the legacy designs amount to — only what was stored or set
 * (the starting components fill in the rest): each molecule, and each type's
 * main component — its frame holding instances of its molecule. A design from
 * before molecules gives its item layout and texts to the card, when that
 * wasn't stored itself.
 */
export function componentsFromLegacy(designs: LegacyDesigns, molecules: LegacyMolecule[]): DesignComponent[] {
  const list = molecules.map(fromMolecule);
  for (const [type, page] of Object.entries(PAGE_COMPONENTS) as [BlockType, { id: string; name: string }][]) {
    const design = designs[type];
    if (!design) continue;
    const { item, texts } = design;
    if ((item?.layout || texts) && !molecules.some((m) => m.id === LEGACY_CARD.id)) {
      list.push(fromMolecule({ ...LEGACY_CARD, layout: item?.layout ?? LEGACY_CARD.layout, slots: LEGACY_CARD.slots.map((slot) => ({ ...slot, ...texts?.[slot.field] })) }));
    }
    if (!design.layout && !item?.molecule && !item?.size) continue;
    const itemId = item?.molecule ?? LEGACY_CARD.id;
    list.push({
      id: page.id,
      name: page.name,
      type,
      layout: design.layout ?? { columnTracks: [{ size: "fill" }, { size: "fill" }], columnGap: 10, rowGap: 10 },
      layers: [
        {
          kind: "instance",
          id: "item",
          name: molecules.find((m) => m.id === itemId)?.name ?? LEGACY_CARD.name,
          component: itemId,
          size: item?.size ?? { height: "fill" },
        },
      ],
    });
  }
  return list;
}
