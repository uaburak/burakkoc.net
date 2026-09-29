"use client";

import type { FrameLook, ShapeLayer, StaticTextLayer, TextField, TextStyle, DesignVariable } from "@/types/design";
import {
  AutoTextarea,
  FieldRow,
  Group,
  LookFields,
  NumberField,
  OpacityField,
  Row,
  SelectField,
  SizeGroup,
  TypographyGroup,
} from "@/components/admin/LiveInspector";

/**
 * The design panel for what is drawn on the Bileşenler page (see
 * CanvasNode) and for the shapes and texts drawn into a main component, as
 * Figma's: where it is (X / Y, on the canvas itself), its size, and its
 * frame's auto layout and look — a shape's look, a text's words, style and
 * alignment. A text drawn into a component can show one of its instances'
 * texts instead (Figma's text property).
 */

/** Figma's X / Y: where a top-level layer sits on the canvas. */
export function PositionGroup({ x, y, onChange }: { x: number; y: number; onChange: (place: { x: number; y: number }) => void }) {
  return (
    <Group title="Konum">
      <FieldRow>
        <NumberField label="X" prefix="X" value={Math.round(x)} min={-100000} max={100000} onChange={(nx) => onChange({ x: nx, y })} />
        <NumberField label="Y" prefix="Y" value={Math.round(y)} min={-100000} max={100000} onChange={(ny) => onChange({ x, y: ny })} />
      </FieldRow>
    </Group>
  );
}

/** The texts of an instance a text in a component can show, by name — its items' (a component used inside others) or its own (a page component's). */
export const TEXT_PROPERTIES: { field: TextField; label: string; page?: boolean }[] = [
  { field: "label", label: "Etiket" },
  { field: "value", label: "Değer" },
  { field: "eyebrow", label: "Üst etiket" },
  { field: "title", label: "Başlık" },
  { field: "text", label: "Metin" },
  { field: "caption", label: "Açıklama" },
  { field: "content", label: "İçerik", page: true },
  { field: "subheading", label: "Alt başlık", page: true },
  { field: "title", label: "Başlık", page: true },
  { field: "author", label: "Kişi", page: true },
  { field: "authorRole", label: "Unvan", page: true },
  { field: "caption", label: "Açıklama", page: true },
];

/** A shape's look and size. */
export function ShapeInspector({ layer, measure, variables, onChange }: {
  layer: ShapeLayer;
  measure: string;
  variables: DesignVariable[];
  onChange: (layer: ShapeLayer) => void;
}) {
  const { kind: _kind, shape: _shape, id: _id, name: _name, size: _size, align: _align, ...look } = layer;
  void _kind;
  void _shape;
  void _id;
  void _name;
  void _size;
  void _align;
  return (
    <div className="flex flex-col">
      <SizeGroup size={layer.size} measure={measure} onChange={(size) => onChange({ ...layer, size })} />
      <LookFields look={look as FrameLook} variables={variables} canHide onChange={(next) => onChange({ ...layer, ...next })} />
    </div>
  );
}

/**
 * A text of its own: its words (typed here too, not only in place), its size,
 * opacity, style and alignment — and, inside a component, `bind` shows one of
 * its instances' texts instead (Figma's text property).
 */
export function StaticTextInspector({ layer, measure, styles, variables, bind, onChange, onEditStyle }: {
  layer: StaticTextLayer;
  measure: string;
  styles: TextStyle[];
  variables: DesignVariable[];
  /** Inside a component: the instances' texts it can show (a page component's own, else its items') */
  bind?: { page: boolean; onBind: (field: TextField) => void };
  onChange: (layer: StaticTextLayer) => void;
  onEditStyle: (styleId: string, under: Element) => void;
}) {
  return (
    <div className="flex flex-col">
      <Group title="İçerik">
        <AutoTextarea label="Metin" value={layer.text} placeholder="Metin" onChange={(text) => onChange({ ...layer, text })} />
        {bind && (
          <Row label="Özellik">
            <SelectField
              label="Metin özelliği: örneklerin hangi metnini göstersin"
              value=""
              placeholder="Kendi metni"
              options={TEXT_PROPERTIES.filter((p) => Boolean(p.page) === bind.page).map((p) => ({ value: p.field, label: p.label }))}
              onChange={(field) => field && bind.onBind(field as TextField)}
            />
          </Row>
        )}
      </Group>
      <SizeGroup size={layer.size} measure={measure} onChange={(size) => onChange({ ...layer, size })} />
      <Group title="Görünüş">
        <FieldRow>
          <OpacityField value={layer.opacity} onChange={(opacity) => onChange({ ...layer, opacity })} />
        </FieldRow>
      </Group>
      <TypographyGroup
        styleId={layer.style ?? "text"}
        styles={styles}
        variables={variables}
        align={{ value: layer.textAlign, onChange: (textAlign) => onChange({ ...layer, textAlign }) }}
        onChange={(style) => onChange({ ...layer, style })}
        onEditStyle={onEditStyle}
      />
    </div>
  );
}
