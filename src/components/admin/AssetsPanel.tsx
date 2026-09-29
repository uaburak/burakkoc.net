"use client";

import { useState, type ReactNode } from "react";
import { useDndMonitor } from "@dnd-kit/core";
import type { BlockType } from "@/types/project";
import type { DesignComponent } from "@/types/design";
import { cn } from "@/lib/utils";
import { DESIGNED_TYPES, topComponents, variantsOf } from "@/components/project/components";
import { byGroup, splitName } from "@/components/project/designVariables";
import { FigmaIcon } from "@/components/admin/figmaIcons";
import { BLOCK_DEFS, BLOCK_GROUPS, BLOCK_LABELS, layerIcon, layerTone, uid } from "@/components/admin/blockCatalog";
import { newDragId, useNewBlockDrag } from "@/components/admin/ProjectDnd";
import { Glyphs } from "@/components/admin/LiveInspector";

/**
 * The left panel's Varlıklar (Assets) tab, as Figma's: the components to put
 * on the page — the site's own (local components: their main components are
 * on the Bileşenler page) and the ones its code draws (a library's: they have
 * no main component to open). Drag one onto the page (a line shows where it
 * goes) or click it to add it where the selection is.
 */

/** A row of the assets: its icon, name and a word on it — a drag handle with the whole row, or a button. */
function AssetRow({ ref, icon, tone, name, hint, dragging = false, action, className, ...rest }: {
  ref?: React.Ref<HTMLDivElement>;
  icon: ReactNode;
  tone: string;
  name: string;
  hint?: string;
  dragging?: boolean;
  /** An icon button at its end, on hover */
  action?: ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      {...rest}
      className={cn(
        "group/asset flex items-center gap-2 h-8 px-2 rounded-[6px] text-left cursor-grab touch-none select-none transition-colors hover:bg-[var(--bg-4)]",
        dragging && "opacity-40",
        className
      )}
    >
      <span className="flex shrink-0" style={{ color: tone }}>{icon}</span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-title)]">{name}</span>
      {hint && <span className="shrink-0 max-w-[45%] truncate text-[11px] text-[var(--text-subtitle)] group-hover/asset:hidden">{hint}</span>}
      {action && <span className="hidden group-hover/asset:flex shrink-0 -mr-1">{action}</span>}
    </div>
  );
}

/**
 * Something to put on the page: `blockId` is the id the next one gets — a
 * fresh one after every drag, so the editor can select it.
 */
function DraggableAsset({ type, component, variants = 0, onAdd, action }: {
  type: BlockType;
  /** One of the site's components of that type */
  component?: DesignComponent;
  /** A component set's: how many variants it has */
  variants?: number;
  onAdd: (type: BlockType, componentId?: string) => void;
  action?: ReactNode;
}) {
  const [blockId, setBlockId] = useState(uid);
  const id = newDragId(type, component?.id);
  const renew = ({ active }: { active: { id: string | number } }) => { if (active.id === id) setBlockId(uid()); };
  useDndMonitor({ onDragEnd: renew, onDragCancel: renew });
  const { setNodeRef, listeners, attributes, isDragging } = useNewBlockDrag(type, blockId, component && { id: component.id, name: component.name });
  const def = BLOCK_DEFS.find((d) => d.type === type);
  return (
    // A div, not a button: the editor's sensor never starts a drag from a button.
    <AssetRow
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      icon={component ? <FigmaIcon name="16.component" /> : layerIcon(type)}
      tone={component ? "var(--edit-component)" : layerTone(type)}
      name={component ? splitName(component.name)[1] || component.name : BLOCK_LABELS[type]}
      // A component set: its variants; a copy of a page component (Proje Künyesi 2): the kind it is.
      hint={variants > 1 ? `${variants} varyant` : component && component.name !== BLOCK_LABELS[type] ? BLOCK_LABELS[type] : undefined}
      title={def?.description}
      dragging={isDragging}
      action={action}
      onClick={() => onAdd(type, component?.id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAdd(type, component?.id); } }}
    />
  );
}

/** A small button at a row's end (Go to main component). */
function RowButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex items-center justify-center w-6 h-6 rounded-[4px] text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:bg-[var(--bg-5)] cursor-pointer"
    >
      {children}
    </button>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="h-8 flex items-center px-2 text-[11px] font-semibold text-[var(--text-title)] select-none">{children}</h3>;
}

export function AssetsPanel({ components, target, onAdd, onGoToMain }: {
  /** The site's components */
  components: DesignComponent[];
  /** Where a click adds, in words */
  target: string;
  onAdd: (type: BlockType, componentId?: string) => void;
  /** Opens a main component on the Bileşenler page */
  onGoToMain: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLocaleLowerCase("tr");
  const matches = (text: string) => !q || text.toLocaleLowerCase("tr").includes(q);
  // A component set once, as its first variant (an instance's properties pick the others).
  const local = topComponents(components).filter((c) => matches(c.name));
  const library = BLOCK_GROUPS.map((kind) => ({
    ...kind,
    // The ones drawn from a main component are among the local components.
    types: kind.types.filter((type) => !DESIGNED_TYPES.has(type) && matches(`${BLOCK_LABELS[type]} ${BLOCK_DEFS.find((d) => d.type === type)?.description ?? ""}`)),
  })).filter((kind) => kind.types.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="px-2">
        <input
          type="search"
          aria-label="Varlıklarda ara"
          placeholder="Varlıklarda ara"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-7 px-2.5 rounded-[5px] bg-[var(--bg-4)] text-[11px] text-[var(--text-title)] placeholder:text-[var(--text-subtitle)] outline-none border border-transparent focus:border-[var(--edit-accent)]"
        />
      </div>
      <p className="px-3 text-[11px] leading-4 text-[var(--text-subtitle)]">
        Sayfaya sürükle — çizgi nereye gireceğini gösterir. Tıklarsan {target} eklenir.
      </p>

      <section className="flex flex-col">
        <Heading>Yerel bileşenler</Heading>
        {[...byGroup(local)].map(([group, list]) => (
          <div key={group || "—"} className="flex flex-col">
            {group && <p className="h-7 flex items-center px-2 text-[11px] text-[var(--text-subtitle)] select-none">{group}</p>}
            {list.map((c) =>
              c.type ? (
                <DraggableAsset
                  key={c.id}
                  type={c.type}
                  component={c}
                  variants={variantsOf(c.id, components).length}
                  onAdd={onAdd}
                  action={<RowButton label="Ana bileşene git" onClick={() => onGoToMain(c.id)}>{Glyphs.goTo}</RowButton>}
                />
              ) : (
                // One used inside others (a Kart): nothing to put on the page on its own — a click opens it.
                <AssetRow
                  key={c.id}
                  icon={<FigmaIcon name="16.component" />}
                  tone="var(--edit-component)"
                  name={splitName(c.name)[1] || c.name}
                  hint="iç bileşen"
                  title="Başka bileşenlerin içinde kullanılır — ana bileşeni açmak için tıkla"
                  className="cursor-pointer"
                  onClick={() => onGoToMain(c.id)}
                  onKeyDown={(e) => { if (e.key === "Enter") onGoToMain(c.id); }}
                />
              )
            )}
          </div>
        ))}
        {local.length === 0 && <p className="px-2 py-1 text-[11px] text-[var(--text-subtitle)]">Eşleşen bileşen yok.</p>}
      </section>

      <section className="flex flex-col">
        <Heading>Hazır bileşenler</Heading>
        <p className="px-2 pb-1 text-[11px] leading-4 text-[var(--text-subtitle)]">Sitenin kodunun çizdikleri — bir kütüphaneninkiler gibi, içleri açılmaz.</p>
        {library.map((kind) => (
          <div key={kind.label} className="flex flex-col">
            <p className="h-7 flex items-center px-2 text-[11px] text-[var(--text-subtitle)] select-none">{kind.label}</p>
            {kind.types.map((type) => <DraggableAsset key={type} type={type} onAdd={onAdd} />)}
          </div>
        ))}
        {library.length === 0 && <p className="px-2 py-1 text-[11px] text-[var(--text-subtitle)]">Eşleşen bileşen yok.</p>}
      </section>
    </div>
  );
}
