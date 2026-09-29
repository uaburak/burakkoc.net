/**
 * Figma's Export: a layer's element saved as PNG, JPG or SVG. The element is
 * cloned with every computed style written inline, wrapped in an SVG
 * foreignObject; a PNG/JPG is that SVG drawn to a canvas at the scale.
 */

import type { ExportSetting } from "./model";

const SKIP = new Set(["data-node-id", "contenteditable"]);

function inlineStyles(source: Element, target: Element) {
  const cs = getComputedStyle(source);
  const style: string[] = [];
  for (let i = 0; i < cs.length; i++) {
    const name = cs[i];
    if (name.startsWith("-webkit-") || name === "cursor" || name === "pointer-events") continue;
    const value = cs.getPropertyValue(name);
    if (value) style.push(`${name}:${value}`);
  }
  target.setAttribute("style", style.join(";"));
  for (const attr of [...target.attributes]) if (SKIP.has(attr.name) || attr.name.startsWith("data-")) target.removeAttribute(attr.name);
  const sk = source.children;
  const tk = target.children;
  for (let i = 0; i < sk.length; i++) if (tk[i]) inlineStyles(sk[i], tk[i]);
}

function toSvg(el: HTMLElement): { svg: string; width: number; height: number } {
  const r = el.getBoundingClientRect();
  const zoom = r.width / (el.offsetWidth || r.width || 1);
  const width = Math.max(1, Math.round(r.width / zoom));
  const height = Math.max(1, Math.round(r.height / zoom));
  const clone = el.cloneNode(true) as HTMLElement;
  inlineStyles(el, clone);
  clone.style.position = "static";
  clone.style.transform = "none";
  clone.style.translate = "none";
  clone.style.left = "0";
  clone.style.top = "0";
  clone.style.margin = "0";
  const html = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px">${html}</div></foreignObject></svg>`;
  return { svg, width, height };
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const safe = (name: string) => name.replace(/[^\w.-]+/g, "_") || "layer";

/** Saves the element as `name`.png/jpg/svg at the scale (a download). */
export async function exportElement(el: HTMLElement, name: string, setting: ExportSetting): Promise<void> {
  const file = `${safe(name)}${setting.scale > 1 ? `@${setting.scale}x` : ""}.${setting.format}`;
  const blob = await renderElement(el, setting);
  if (blob) download(blob, file);
}

/** Copies the element to the clipboard as SVG text or a PNG image (Figma's Copy as). */
export async function copyElementAs(el: HTMLElement, format: "svg" | "png"): Promise<void> {
  const blob = await renderElement(el, { scale: 2, format });
  if (!blob) return;
  if (format === "svg") return navigator.clipboard.writeText(await blob.text());
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

/** The element drawn as a file's bytes: an SVG, or a PNG/JPG at the scale. */
export async function renderElement(el: HTMLElement, setting: ExportSetting): Promise<Blob | null> {
  const { svg, width, height } = toSvg(el);
  if (setting.format === "svg") return new Blob([svg], { type: "image/svg+xml" });
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG could not be drawn"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width * setting.scale;
    canvas.height = height * setting.scale;
    const g = canvas.getContext("2d")!;
    if (setting.format === "jpg") { g.fillStyle = "#ffffff"; g.fillRect(0, 0, canvas.width, canvas.height); }
    g.scale(setting.scale, setting.scale);
    g.drawImage(img, 0, 0);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, setting.format === "jpg" ? "image/jpeg" : "image/png", 0.92));
  } finally {
    URL.revokeObjectURL(url);
  }
}
