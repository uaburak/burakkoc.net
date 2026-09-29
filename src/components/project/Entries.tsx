"use client";

import { Fragment, type CSSProperties, type ElementType, type ReactNode } from "react";
import { SortableGroup, SortableItem } from "./Sortable";

/**
 * A layer's items (a component's entries, a list's items): a static list on
 * the page; in the editor a sortable group — drag to move (Alt-drag leaves a
 * copy). Each item is its own element, marked with the component it is an
 * instance of (`data-component`); on the page one can be a link.
 */
export function Entries<T extends { id: string }>({
  items, onMove, as: Tag = "div", className, style, frame, component, itemAs: ItemTag = "div", itemClassName, itemStyle, itemProps, strategy = "grid", wrap, render,
}: {
  items: T[];
  /** In the editor: moves an item (see BlockEditApi.moveEntry) — static without it */
  onMove?: (activeId: string, overId: string, copy?: boolean) => void;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  /** Attributes of the frame (its layer's id, its prototype's handlers…) */
  frame?: Record<string, unknown>;
  /** The component its items are instances of (see DesignComponent), as their `data-component` */
  component?: string;
  itemAs?: ElementType;
  itemClassName?: string | ((item: T, index: number) => string | undefined);
  /** Each item's style — its own one, for items that are instances with their overrides */
  itemStyle?: CSSProperties | ((item: T, index: number) => CSSProperties);
  /** On the page: an item's own element and attributes (a link, its prototype's handlers — its `style` goes over itemStyle) */
  itemProps?: (item: T) => { as?: ElementType; [attribute: string]: unknown } | undefined;
  strategy?: "grid" | "vertical";
  /** On the page: each item wrapped (in its scroll reveal) */
  wrap?: (node: ReactNode, item: T) => ReactNode;
  render: (item: T, index: number) => ReactNode;
}) {
  const cls = (item: T, i: number) => (typeof itemClassName === "function" ? itemClassName(item, i) : itemClassName);
  const css = (item: T, i: number) => (typeof itemStyle === "function" ? itemStyle(item, i) : itemStyle);

  if (!onMove) {
    return (
      <Tag className={className} style={style} {...frame}>
        {items.map((item, i) => {
          const { as: Own = ItemTag, style: own, ...props } = itemProps?.(item) ?? {};
          const node = (
            <Own key={item.id} data-component={component} className={cls(item, i)} {...props} style={{ ...css(item, i), ...(own as CSSProperties | undefined) }}>
              {render(item, i)}
            </Own>
          );
          return wrap ? <Fragment key={item.id}>{wrap(node, item)}</Fragment> : node;
        })}
      </Tag>
    );
  }

  return (
    <SortableGroup ids={items.map((item) => item.id)} onMove={onMove} strategy={strategy}>
      <Tag className={className} style={style} {...frame}>
        {items.map((item, i) => (
          <SortableItem key={item.id} id={item.id} as={ItemTag} component={component} className={cls(item, i)} style={css(item, i)}>
            {render(item, i)}
          </SortableItem>
        ))}
      </Tag>
    </SortableGroup>
  );
}
