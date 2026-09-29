import type { BlockType, GridSettings, GridTrack, Sizing } from "@/types/project";
import type { ComponentLayer, DesignComponent, FrameLayer, FrameLook, InstanceLayer, PartKind, PartLayer, TextField, TextLayer } from "@/types/design";

/**
 * The site's first components: one main component for each kind of layer the
 * page holds (its type), and one for each item those repeat (a Kart, a
 * Metrik, an Adım…) — each drawing exactly what the site's code drew before
 * them (the same sizes, spacing, corners, fills and text styles), so pages
 * only change once one of them is edited. The pieces the code still draws
 * (an image, an avatar, a bar, an icon…) are parts (see PartLayer).
 */

const fill = (n: number): GridTrack[] => Array.from({ length: n }, () => ({ size: "fill" }));
const alias = (id: string) => ({ alias: id });
const filled = (color: string): FrameLook => ({ fill: { color: alias(color) } });
const stroked = (color: string): FrameLook => ({ stroke: { color: alias(color), weight: { value: 1 }, align: "inside" } });

const hug: Sizing = { width: "hug" };

const text = (id: string, name: string, field: TextField, style: string, extra: Partial<TextLayer> = {}): TextLayer => ({ kind: "text", id, name, field, style, ...extra });
const part = (id: string, name: string, kind: PartKind, size?: Sizing): PartLayer => ({ kind: "part", id, name, part: kind, ...(size ? { size } : {}) });
/**
 * A frame's auto layout: no gaps unless given (the code's frames had none —
 * the auto layout's own default is 16px). Items on a grid are Fill height:
 * a row's cards are as tall as its tallest, as the code's grids stretched them.
 */
const gapless = (layout: GridSettings): GridSettings => ({ columnGap: 0, rowGap: 0, ...layout });
const frame = (id: string, name: string, layout: GridSettings, layers: ComponentLayer[], extra: Partial<FrameLayer> = {}): FrameLayer => ({ kind: "frame", id, name, layout: gapless(layout), layers, ...extra });
const repeat = (name: string, component: string, size?: Sizing): InstanceLayer => ({ kind: "instance", id: "item", name, component, ...(size ? { size } : {}) });
const main = (id: string, name: string, type: BlockType | undefined, layout: GridSettings, layers: ComponentLayer[], look: FrameLook = {}): DesignComponent => ({
  id,
  name,
  ...(type ? { type } : {}),
  layout: gapless(layout),
  layers,
  ...look,
});

/** A media layer's frame: the medium, its caption centred under it — 48px over them, 36 under. */
const MEDIA_LAYOUT: GridSettings = { flow: "vertical", justify: "center", rowGap: 24, paddingTop: 48, paddingBottom: 36 };
/** A table's or a chart's: 16px over and under. */
const BOARD_LAYOUT: GridSettings = { flow: "vertical", justify: "center", rowGap: 24, paddingTop: 16, paddingBottom: 16 };
const caption = () => text("caption", "Açıklama", "caption", "caption", { textAlign: "center" });

export const STARTING_COMPONENTS: DesignComponent[] = [
  // ── Texts ──
  main("heading", "Başlık", "heading", { flow: "vertical" }, [
    text("content", "Başlık", "content", "section-title"),
    text("subheading", "Alt başlık", "subheading", "subtitle"),
  ]),
  main("subheading", "Alt Başlık", "subheading", { flow: "vertical" }, [text("content", "Alt başlık", "content", "subtitle")]),
  main("text", "Metin", "text", { flow: "vertical" }, [text("content", "Paragraf", "content", "text")]),

  // ── The Proje Künyesi: two columns of Kart's 10px apart, each as tall as its row ──
  main("project-info", "Proje Künyesi", "info", { columnTracks: fill(2), columnGap: 10, rowGap: 10 }, [
    repeat("Kart", "card", { height: "fill" }),
  ]),
  // Its label (Etiket) over its value (Değer), 12 / 16px in, 2px apart, 22px corners, filled with the bg-4 grey.
  main("card", "Kart", undefined, { flow: "vertical", paddingX: 16, paddingY: 12, rowGap: 2 }, [
    text("label", "Etiket", "label", "label"),
    text("value", "Değer", "value", "value"),
  ], { radius: alias("radius-card"), ...filled("bg-4") }),

  // ── Media ──
  main("image", "Görsel", "image", MEDIA_LAYOUT, [part("media", "Görsel", "media"), caption()]),
  main("video", "Video", "video", MEDIA_LAYOUT, [part("media", "Video", "video"), caption()]),
  main("code", "Kod", "code", MEDIA_LAYOUT, [part("media", "Kod", "code"), caption()]),
  main("figma", "Figma", "figma", { flow: "vertical" }, [part("embed", "Figma", "figma")]),
  main("iframe", "iFrame", "iframe", { flow: "vertical" }, [part("embed", "iFrame", "iframe")]),

  // ── Lists ──
  main("list", "Liste", "list", { flow: "vertical", rowGap: 10 }, [repeat("Liste öğesi", "list-item")]),
  main("list-item", "Liste öğesi", undefined, { flow: "horizontal", columnGap: 10, paddingX: 16, paddingY: 10 }, [
    part("marker", "İşaret", "list-marker", hug),
    text("text", "Metin", "text", "body"),
  ], { radius: alias("radius-card"), ...filled("bg-4") }),

  main("stats", "Metrikler", "stats", { columnTracks: fill(3), columnGap: 10, rowGap: 10, small: { columns: 2 } }, [repeat("Metrik", "metric", { height: "fill" })]),
  main("metric", "Metrik", undefined, { flow: "vertical", rowGap: 4, paddingX: 20, paddingY: 20 }, [
    text("value", "Değer", "value", "metric"),
    text("label", "Açıklama", "label", "label"),
  ], { radius: alias("radius-card"), ...filled("bg-4") }),

  main("cards", "Kartlar", "cards", { columnTracks: fill(2), columnGap: 10, rowGap: 10, small: { columns: 1 } }, [repeat("Özellik kartı", "feature-card", { height: "fill" })]),
  main("feature-card", "Özellik kartı", undefined, { flow: "vertical", rowGap: 8, paddingX: 20, paddingY: 20 }, [
    text("eyebrow", "Üst etiket", "eyebrow", "label"),
    text("title", "Başlık", "title", "strong"),
    text("text", "Açıklama", "text", "body"),
  ], { radius: alias("radius-card"), ...filled("bg-4") }),

  main("steps", "Süreç", "steps", { flow: "vertical", rowGap: 32 }, [repeat("Adım", "step")]),
  main("step", "Adım", undefined, { flow: "horizontal", columnGap: 16 }, [
    part("line", "Çizgi", "step-line", hug),
    part("number", "Numara", "step-number", hug),
    frame("content", "İçerik", { flow: "vertical", rowGap: 4, paddingTop: 4 }, [
      frame("heading", "Başlık satırı", { flow: "horizontal", wrap: true, columnGap: 8, rowGap: 0, baseline: true }, [
        text("title", "Başlık", "title", "strong", { size: hug }),
        text("eyebrow", "Zaman", "eyebrow", "label", { size: hug }),
      ]),
      text("text", "Açıklama", "text", "text"),
    ], { size: hug }),
  ]),

  main("accordion", "Açılır Detaylar", "accordion", { flow: "vertical", rowGap: 10 }, [repeat("Madde", "accordion-item")]),
  main("accordion-item", "Madde", undefined, { flow: "vertical" }, [
    frame("head", "Başlık satırı", { flow: "horizontal", spread: true, align: "center", columnGap: 16, paddingX: 20, paddingY: 14 }, [
      text("title", "Başlık", "title", "value", { size: hug }),
      part("chevron", "Ok", "chevron", hug),
    ]),
    frame("body", "İçerik", { flow: "vertical", paddingX: 20, paddingBottom: 16 }, [text("text", "İçerik", "text", "text")]),
  ], { radius: alias("radius-card"), ...filled("bg-4") }),

  main("links", "Bağlantılar", "links", { flow: "horizontal", wrap: true, columnGap: 8, rowGap: 8 }, [
    repeat("Bağlantı", "link", { width: "hug", height: "fixed", heightPx: 40 }),
  ]),
  main("link", "Bağlantı", undefined, { flow: "horizontal", align: "center", columnGap: 8, paddingX: 16 }, [
    part("icon", "İkon", "link-icon", hug),
    text("label", "Etiket", "label", "small-strong", { size: hug }),
  ], { radius: alias("radius-pill"), ...filled("bg-2"), ...stroked("border") }),

  main("tags", "Etiketler", "tags", { flow: "horizontal", wrap: true, columnGap: 8, rowGap: 8 }, [
    repeat("Etiket", "tag", { width: "hug", height: "fixed", heightPx: 32 }),
  ]),
  main("tag", "Etiket", undefined, { flow: "horizontal", align: "center", paddingX: 14 }, [text("label", "Etiket", "label", "chip", { size: hug })], {
    radius: alias("radius-pill"),
    ...filled("bg-4"),
  }),

  main("team", "Ekip", "team", { columnTracks: fill(2), columnGap: 10, rowGap: 10, small: { columns: 1 } }, [repeat("Kişi", "person", { height: "fill" })]),
  main("person", "Kişi", undefined, { flow: "horizontal", align: "center", columnGap: 12, paddingTop: 12, paddingBottom: 12, paddingLeft: 12, paddingRight: 16 }, [
    part("avatar", "Avatar", "avatar", { width: "fixed", widthPx: 44 }),
    frame("names", "Ad", { flow: "vertical" }, [text("title", "Ad Soyad", "title", "strong"), text("text", "Rol", "text", "label")]),
    part("external", "Bağlantı işareti", "external-mark", hug),
  ], { radius: alias("radius-card"), ...filled("bg-4") }),

  main("palette", "Renk Paleti", "palette", { columnTracks: fill(4), columnGap: 10, rowGap: 10, small: { columns: 2 } }, [repeat("Renk", "color", { height: "fill" })]),
  main("color", "Renk", undefined, { flow: "vertical" }, [
    part("swatch", "Renk örneği", "swatch"),
    frame("info", "Bilgi", { flow: "vertical", rowGap: 2, paddingX: 16, paddingY: 12 }, [
      text("label", "Ad", "label", "small-strong"),
      text("value", "Kod", "value", "micro"),
      text("text", "Kullanım", "text", "micro-light"),
    ]),
  ], { radius: alias("radius-card"), ...filled("bg-4"), clip: true }),

  // ── Surfaces ──
  main("quote", "Alıntı", "quote", { flow: "vertical", rowGap: 20, paddingX: 32, paddingY: 32, small: { paddingX: 24, paddingY: 28 } }, [
    part("mark", "Tırnak", "quote-mark"),
    text("content", "Alıntı", "content", "quote"),
    frame("person", "Kişi", { flow: "vertical" }, [text("author", "Kişi", "author", "section-title"), text("role", "Unvan", "authorRole", "subtitle")]),
  ], { radius: alias("radius-panel"), ...filled("bg-4") }),

  main("callout", "Not Kutusu", "callout", { flow: "horizontal", columnGap: 14, paddingX: 20, paddingY: 20 }, [
    part("icon", "İkon", "callout-icon", hug),
    frame("body", "Metin", { flow: "vertical", rowGap: 4 }, [text("title", "Başlık", "title", "strong"), text("content", "Metin", "content", "text")]),
  ], { radius: alias("radius-card"), ...filled("bg-4") }),

  main("split", "Görsel + Metin", "split", { columnTracks: fill(2), columnGap: 32, rowGap: 32, align: "center", paddingTop: 24, paddingBottom: 24, small: { columns: 1 } }, [
    part("image", "Görsel", "split-image"),
    frame("body", "Metin", { flow: "vertical", rowGap: 8 }, [text("title", "Başlık", "title", "strong"), text("content", "Metin", "content", "text")]),
  ]),

  main("persona", "Persona", "persona", { flow: "vertical", rowGap: 20, paddingX: 24, paddingY: 24, small: { paddingX: 20, paddingY: 20 } }, [
    frame("identity", "Kimlik", { flow: "horizontal", align: "center", columnGap: 16 }, [
      part("avatar", "Avatar", "avatar", { width: "fixed", widthPx: 64 }),
      frame("names", "Ad", { flow: "vertical" }, [text("title", "Ad", "title", "strong"), text("subheading", "Tanım", "subheading", "subtitle")], { size: hug }),
    ]),
    text("content", "Tanım", "content", "text"),
    frame("groups", "Gruplar", { columnTracks: fill(2), columnGap: 10, rowGap: 10, small: { columns: 1 } }, [repeat("Grup", "persona-group", { height: "fill" })]),
  ], { radius: alias("radius-panel"), ...filled("bg-4") }),
  main("persona-group", "Grup", undefined, { flow: "vertical", rowGap: 8, paddingX: 16, paddingY: 16 }, [
    text("label", "Başlık", "label", "small-strong"),
    text("text", "Maddeler", "text", "small-light"),
  ], { radius: alias("radius-inner"), ...filled("bg-1") }),

  main("gallery", "Galeri", "gallery", MEDIA_LAYOUT, [
    frame("grid", "Görseller", { columnTracks: fill(2), columnGap: 12, rowGap: 12, small: { columns: 1 } }, [repeat("Galeri görseli", "gallery-item", { height: "fill" })]),
    caption(),
  ]),
  main("gallery-item", "Galeri görseli", undefined, { flow: "vertical", rowGap: 12 }, [
    part("image", "Görsel", "item-image"),
    text("caption", "Görsel altı", "caption", "caption", { textAlign: "center" }),
  ], { radius: alias("radius-media") }),

  main("compare", "Önce / Sonra", "compare", MEDIA_LAYOUT, [part("slider", "Karşılaştırma", "compare"), caption()]),

  main("mockup", "Cihaz Çerçevesi", "mockup", MEDIA_LAYOUT, [
    frame("panel", "Panel", { flow: "vertical", paddingX: 40, paddingY: 40, small: { paddingX: 16, paddingY: 16 } }, [part("devices", "Cihazlar", "devices")], {
      radius: alias("radius-panel"),
      ...filled("bg-4"),
      ...stroked("border"),
      clip: true,
    }),
    caption(),
  ]),

  main("table", "Tablo", "table", BOARD_LAYOUT, [part("table", "Tablo", "table"), caption()]),

  main("bars", "Anket Sonuçları", "bars", BOARD_LAYOUT, [
    frame("card", "Kart", { flow: "vertical", rowGap: 16, paddingX: 20, paddingY: 20 }, [
      text("title", "Soru", "title", "strong"),
      frame("bars", "Çubuklar", { flow: "vertical", rowGap: 16 }, [repeat("Çubuk", "bar-item")]),
    ], { radius: alias("radius-card"), ...filled("bg-4") }),
    caption(),
  ]),
  main("bar-item", "Çubuk", undefined, { flow: "vertical", rowGap: 8 }, [
    frame("row", "Satır", { flow: "horizontal", spread: true, baseline: true, columnGap: 16 }, [
      text("label", "Seçenek", "label", "small", { size: hug }),
      text("value", "Yüzde", "value", "small-strong", { size: hug }),
    ]),
    part("bar", "Çubuk", "bar"),
    text("text", "Not", "text", "caption"),
  ]),
];
