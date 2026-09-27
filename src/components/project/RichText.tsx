import { Fragment, ReactNode } from "react";

/**
 * Minimal inline formatting for project copy:
 *   **kalın**           → <strong>
 *   [etiket](https://…) → <a>
 *
 * Anything else renders as plain text, so existing content is unaffected.
 * Only http(s), mailto and site-relative links are rendered as anchors;
 * other schemes (e.g. javascript:) fall back to their label.
 */

const TOKEN = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function isSafeHref(href: string) {
  return /^(https?:\/\/|mailto:|\/)/i.test(href);
}

export function renderRichText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let key = 0;

  for (const match of text.matchAll(TOKEN)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push(<Fragment key={key++}>{text.slice(last, start)}</Fragment>);

    const [, bold, label, href] = match;
    if (bold !== undefined) {
      nodes.push(
        <strong key={key++} className="font-medium text-[var(--text-title)]">
          {bold}
        </strong>
      );
    } else if (isSafeHref(href)) {
      const external = /^https?:\/\//i.test(href);
      nodes.push(
        <a
          key={key++}
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="font-normal text-[var(--text-title)] underline decoration-[var(--project-accent,var(--border-hover))] underline-offset-4 transition-colors duration-200 hover:decoration-[var(--project-accent,var(--text-title))]"
        >
          {label}
        </a>
      );
    } else {
      nodes.push(<Fragment key={key++}>{label}</Fragment>);
    }
    last = start + match[0].length;
  }

  if (last < text.length) nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return nodes;
}

export function RichText({ text }: { text: string }) {
  return <>{renderRichText(text)}</>;
}
