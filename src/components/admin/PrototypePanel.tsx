"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Block, BlockType } from "@/types/project";
import type { DesignComponent, Interaction, InteractionAnimation, InteractionEasing, InteractionTrigger } from "@/types/design";
import { cn } from "@/lib/utils";
import { FigmaIcon } from "@/components/admin/figmaIcons";
import { FieldRow, Glyphs, Group, NumberField, Row, SelectField, SquareButton } from "@/components/admin/LiveInspector";
import { ItemComponentView, ProjectBlock } from "@/components/project/ComponentView";
import { DesignSystemStyle } from "@/components/project/designSystem";
import { ANIMATIONS, EASINGS, TRIGGERS } from "@/components/project/interactions";
import { variantName } from "@/components/project/components";

/**
 * The design panel's Prototip tab, as Figma's Prototype panel for an
 * interactive component: a variant's interactions — what starts each (a
 * click, the pointer over it, a press, a delay), the variant it changes to,
 * and how it animates (instant, dissolve, Smart animate; its easing and
 * duration). "Önizle" plays the set in a window, as Figma's preview.
 */

const options = <T extends string>(record: Record<T, string>) => (Object.keys(record) as T[]).map((value) => ({ value, label: record[value] }));
const EASING_OPTIONS = (Object.keys(EASINGS) as InteractionEasing[]).map((value) => ({ value, label: EASINGS[value].label }));

/** One interaction, as Figma's interaction details: trigger, action, animation. */
function InteractionFields({ interaction, variants, onChange, onRemove }: {
  interaction: Interaction;
  /** The variants it can change to */
  variants: DesignComponent[];
  onChange: (interaction: Interaction) => void;
  onRemove: () => void;
}) {
  const animated = interaction.animation !== "instant";
  return (
    <div className="flex flex-col gap-2 p-2 -mx-2 rounded-[8px] bg-[color-mix(in_srgb,var(--bg-4)_55%,transparent)]">
      <div className="flex items-center justify-between gap-2 h-6">
        <span className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--edit-accent)] select-none">
          <FigmaIcon name="16.cursor" />
          {TRIGGERS[interaction.trigger]} → {variantName(variants.find((v) => v.id === interaction.target) ?? { name: "—" })}
        </span>
        <SquareButton label="Etkileşimi kaldır" onClick={onRemove}>{Glyphs.minus}</SquareButton>
      </div>
      <Row label="Olay">
        <SelectField label="Olay" value={interaction.trigger} options={options(TRIGGERS)} onChange={(trigger) => onChange({ ...interaction, trigger: trigger as InteractionTrigger })} />
      </Row>
      {interaction.trigger === "delay" && (
        <Row label="Bekleme">
          <NumberField label="Bekleme (ms)" prefix="ms" value={interaction.delay ?? 800} min={0} max={60000} onChange={(delay) => onChange({ ...interaction, delay })} />
        </Row>
      )}
      <Row label="Değiştir">
        <SelectField
          label="Hangi varyanta"
          value={interaction.target}
          options={variants.map((v) => ({ value: v.id, label: variantName(v) }))}
          onChange={(target) => target && onChange({ ...interaction, target })}
        />
      </Row>
      <Row label="Animasyon">
        <SelectField label="Animasyon" value={interaction.animation} options={options(ANIMATIONS)} onChange={(animation) => onChange({ ...interaction, animation: animation as InteractionAnimation })} />
      </Row>
      {animated && (
        <>
          <Row label="Yumuşatma">
            <SelectField label="Yumuşatma" value={interaction.easing} options={EASING_OPTIONS} onChange={(easing) => onChange({ ...interaction, easing: easing as InteractionEasing })} />
          </Row>
          <Row label="Süre">
            <NumberField label="Süre (ms)" prefix="ms" value={interaction.duration} min={16} max={10000} onChange={(duration) => onChange({ ...interaction, duration })} />
          </Row>
        </>
      )}
    </div>
  );
}

/** The Prototip tab for a variant: its interactions, "+" adding one (to the next variant), and the preview. */
export function PrototypePanel({ variant, variants, onChange, onAdd, onPreview }: {
  variant: DesignComponent;
  /** Its set's variants — the ones it can change to */
  variants: DesignComponent[];
  onChange: (interactions: Interaction[]) => void;
  onAdd: () => void;
  onPreview: () => void;
}) {
  const interactions = variant.interactions ?? [];
  const others = variants.filter((v) => v.id !== variant.id);
  return (
    <div className="flex flex-col">
      <Group title="Etkileşimler" actions={<SquareButton label="Etkileşim ekle" onClick={onAdd}>{Glyphs.plus}</SquareButton>}>
        {interactions.map((interaction) => (
          <InteractionFields
            key={interaction.id}
            interaction={interaction}
            variants={others.length ? others : variants}
            onChange={(next) => onChange(interactions.map((i) => (i.id === next.id ? next : i)))}
            onRemove={() => onChange(interactions.filter((i) => i.id !== interaction.id))}
          />
        ))}
        {interactions.length === 0 && (
          <p className="text-[11px] leading-4 text-[var(--text-subtitle)]">
            Henüz yok. &quot;+&quot; ile ekle — ya da kanvasta varyantın sağındaki mavi noktayı başka bir varyanta sürükle.
          </p>
        )}
      </Group>
      <PreviewGroup onPreview={onPreview} />
    </div>
  );
}

/** "Önizle": the set's prototype in its window. */
export function PreviewGroup({ onPreview, note }: { onPreview: () => void; note?: string }) {
  return (
    <Group title="Önizleme">
      {note && <p className="text-[11px] leading-4 text-[var(--text-subtitle)]">{note}</p>}
      <FieldRow wide>
        <button
          type="button"
          onClick={onPreview}
          className="flex items-center justify-center gap-1.5 h-6 rounded-[5px] bg-[var(--edit-accent)] text-[11px] font-medium text-white hover:brightness-110 transition-[filter] cursor-pointer"
        >
          <span aria-hidden>▶</span> Önizle
        </button>
      </FieldRow>
      <p className="text-[11px] leading-4 text-[var(--text-subtitle)]">Sitede bu bileşenin her örneği bu etkileşimleri oynatır.</p>
    </Group>
  );
}

/**
 * Figma's prototype preview: the component, from `component`, playing its
 * interactions in a window over the editor — "Baştan" starts it again; Esc,
 * the ✕ or a click outside closes it.
 */
export function PrototypePreview({ component, holderType, width, sampleBlock, onClose }: {
  component: DesignComponent;
  /** One used inside others: the page component repeating it (its items give it its texts) */
  holderType?: BlockType;
  width: number;
  sampleBlock: (type: BlockType) => Block;
  onClose: () => void;
}) {
  const [run, setRun] = useState(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="dialog"
      aria-label="Prototip önizlemesi"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-w-[92vw] max-h-[90vh] flex-col overflow-hidden rounded-[13px] bg-[var(--bg-1)] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between gap-3 h-11 pl-4 pr-2 border-b border-[var(--border)]">
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-[var(--text-title)]">
            <span className="flex text-[var(--edit-component)]"><FigmaIcon name="16.component" /></span>
            <span className="truncate">{component.name}</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setRun((r) => r + 1)}
              className="h-6 px-2.5 rounded-[5px] text-[11px] font-medium text-[var(--text-title)] hover:bg-[var(--bg-4)] cursor-pointer"
            >
              Baştan
            </button>
            <SquareButton label="Kapat" onClick={onClose}>{Glyphs.close}</SquareButton>
          </div>
        </div>
        <div data-design-scope="" className={cn("overflow-auto p-12", component.type && "bg-[var(--bg-1)]")}>
          <DesignSystemStyle />
          <div key={run} style={{ width }}>
            {component.type ? (
              <ProjectBlock block={{ ...sampleBlock(component.type), id: `preview-${component.id}`, component: component.id }} interactive />
            ) : (
              <ItemComponentView component={component} type={holderType} entry={holderType ? sampleBlock(holderType).entries?.[0] : undefined} interactive />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
