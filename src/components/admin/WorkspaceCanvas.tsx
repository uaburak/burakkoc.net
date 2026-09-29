"use client";

import { useEffect, useState } from "react";
import type { Block } from "@/types/project";
import type { CanvasNode, FrameLayer, ShapeLayer, StaticTextLayer } from "@/types/design";
import { allLayers, insertLayer, removeLayer, updateLayer } from "@/components/project/components";
import { uid } from "@/components/admin/blockCatalog";
import { ComponentsCanvas } from "@/components/admin/ComponentsCanvas";
import { isNodeSelection, type CanvasSelection, type CanvasTool, type CanvasView } from "@/components/admin/canvasModel";
import { DesignSystemStyle } from "@/components/project/designSystem";

type TopTarget = { componentId: string } | { nodeId: string };
type Rect = { x: number; y: number; w: number; h: number };
type DrawnLayer = FrameLayer | ShapeLayer | StaticTextLayer;

/**
 * Çalışma Alanı: a bare canvas of its own — draw frames, shapes and texts,
 * pan and zoom, nothing else on it. The Bileşenler page's canvas engine
 * (ComponentsCanvas), without its main components: a place to build the
 * canvas itself (its pan, zoom, pixel grid, snapping) on its own, before
 * Bileşenler's components come back into it.
 */
export function WorkspaceCanvas({
  nodes,
  onNodes,
  view,
  onView,
  tool,
  onTool,
  selection,
  onSelect,
}: {
  nodes: CanvasNode[];
  onNodes: (update: (nodes: CanvasNode[]) => CanvasNode[]) => void;
  view: CanvasView;
  onView: (update: (view: CanvasView) => CanvasView) => void;
  tool: CanvasTool;
  onTool: (tool: CanvasTool) => void;
  selection: CanvasSelection | null;
  onSelect: (next: CanvasSelection | null) => void;
}) {
  const [autoEdit, setAutoEdit] = useState<string | null>(null);

  const updateNode = (nodeId: string, update: (node: CanvasNode) => CanvasNode) => onNodes((list) => list.map((n) => (n.id === nodeId ? update(n) : n)));
  const setNodeLayer = (nodeId: string, layerId: string, update: (layer: DrawnLayer) => DrawnLayer) =>
    updateNode(nodeId, (node) => {
      if (layerId === node.id) return { ...update(node), canvas: node.canvas };
      return node.kind === "frame" ? (updateLayer(node, layerId, update as (l: FrameLayer["layers"][number]) => FrameLayer["layers"][number]) as CanvasNode) : node;
    });
  /** The next name of a kind drawn: "Çerçeve 3" after "Çerçeve 2", as Figma numbers them. */
  const drawnName = (base: string) => {
    const drawn = nodes.flatMap((n) => (n.kind === "frame" ? [n, ...allLayers(n.layers)] : [n]));
    const numbers = drawn.map((l) => Number(l.name.match(new RegExp(`^${base} (\\d+)$`))?.[1] ?? 0));
    return `${base} ${Math.max(0, ...numbers) + 1}`;
  };

  // ⌫: a drawing, or a layer of one (its frame's other layers stay) — never while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (!selection || !isNodeSelection(selection)) return;
      const node = nodes.find((n) => n.id === selection.nodeId);
      if (!node) return;
      e.preventDefault();
      if (selection.layerId && selection.layerId !== node.id) {
        const layerId = selection.layerId;
        onNodes((list) => list.map((n) => (n.id === node.id && n.kind === "frame" ? (removeLayer(n, layerId) as CanvasNode) : n)));
        onSelect({ nodeId: node.id });
      } else {
        onNodes((list) => list.filter((n) => n.id !== node.id));
        onSelect(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, nodes, onNodes, onSelect]);

  return (
    <div data-design-scope="" className="absolute inset-0">
      <DesignSystemStyle />
      <ComponentsCanvas
        components={[]}
        nodes={nodes}
        places={new Map()}
        onMeasure={() => {}}
        sampleBlock={(): Block => {
          throw new Error("Çalışma Alanı'nda sayfa bileşeni yok");
        }}
        selection={selection}
        view={view}
        onView={onView}
        tool={tool}
        onTool={onTool}
        onSelect={onSelect}
        onAddVariant={() => {}}
        onContextMenu={(at) => onSelect(at)}
        onMove={(target: TopTarget, place) => {
          if ("nodeId" in target) updateNode(target.nodeId, (n) => ({ ...n, canvas: { ...n.canvas, ...place } }));
        }}
        onResize={(at: CanvasSelection, rect: Rect, changed) => {
          const sized = (size?: DrawnLayer["size"]) => ({
            ...size,
            ...(changed.x ? { width: "fixed" as const, widthPx: rect.w } : {}),
            ...(changed.y ? { height: "fixed" as const, heightPx: rect.h, ratio: undefined } : {}),
          });
          if (!isNodeSelection(at)) return;
          if (!at.layerId || at.layerId === at.nodeId) return updateNode(at.nodeId, (n) => ({ ...n, size: sized(n.size), canvas: { ...n.canvas, x: rect.x, y: rect.y } }));
          setNodeLayer(at.nodeId, at.layerId, (l) => ({ ...l, size: sized(l.size) }));
        }}
        onDraw={(drawn, rect, parent) => {
          const id = uid();
          const size = drawn === "text" ? ({ width: "hug" } as const) : ({ width: "fixed" as const, widthPx: rect.w, height: "fixed" as const, heightPx: rect.h });
          const layer: DrawnLayer =
            drawn === "frame"
              ? { kind: "frame", id, name: drawnName("Çerçeve"), layout: { flow: "vertical" }, layers: [], fill: { color: { value: "#FFFFFF" } }, size }
              : drawn === "text"
                ? { kind: "static-text", id, name: "", text: "", style: "text", size }
                : { kind: "shape", shape: drawn === "ellipse" ? "ellipse" : "rectangle", id, name: drawnName(drawn === "ellipse" ? "Elips" : "Dikdörtgen"), fill: { color: { value: "#D9D9D9" } }, size };
          onTool("move");
          if (!parent) {
            onNodes((list) => [...list, { ...layer, canvas: { x: rect.x, y: rect.y } }]);
            onSelect({ nodeId: id });
          } else if ("nodeId" in parent) {
            const frameId = parent.frameId;
            updateNode(parent.nodeId, (n) => (n.kind === "frame" ? { ...(insertLayer(n, frameId, layer) as CanvasNode), canvas: n.canvas } : n));
            onSelect({ nodeId: parent.nodeId, layerId: id });
          }
          if (drawn === "text") setAutoEdit(id);
        }}
        onStaticText={(target: TopTarget, layerId, text) => {
          if ("nodeId" in target) setNodeLayer(target.nodeId, layerId, (l) => (l.kind === "static-text" ? { ...l, text } : l));
        }}
        autoEdit={autoEdit}
      />
    </div>
  );
}
