"use client";

import { useRef, useEffect, useState } from "react";
import { Block } from "@/types/project";
import { BadgesEditor } from "@/components/admin/BadgesEditor";
import { COMPONENT_REGISTRY } from "@/components/demos/ComponentRegistry";

interface CodeBlockEditorProps {
  block: Block;
  onChange: (updates: Partial<Block>) => void;
}

const LANGUAGES = ["tsx", "jsx", "ts", "js", "css", "html", "json", "bash", "python"];

/** Map our language labels to Prettier parser names */
function getPrettierParser(lang: string): string | null {
  const map: Record<string, string> = {
    tsx: "babel-ts",
    jsx: "babel",
    ts: "babel-ts",
    js: "babel",
    css: "css",
    html: "html",
    json: "json",
  };
  return map[lang] ?? null;
}

/** Dynamically load Prettier + required parser plugin in the browser */
async function formatCode(code: string, lang: string): Promise<string> {
  const parser = getPrettierParser(lang);
  if (!parser || !code.trim()) return code;

  const [prettier, babelPlugin, htmlPlugin, cssPlugin] = await Promise.all([
    import("prettier/standalone"),
    import("prettier/plugins/babel"),
    import("prettier/plugins/html"),
    import("prettier/plugins/postcss"),
  ]);

  // Pick the right plugin for the parser
  const pluginMap: Record<string, object[]> = {
    "babel": [babelPlugin],
    "babel-ts": [babelPlugin],
    "html": [htmlPlugin],
    "css": [cssPlugin],
    "json": [babelPlugin],
  };
  const plugins = pluginMap[parser] ?? [babelPlugin];

  try {
    let result = await prettier.format(code, {
      parser,
      plugins,
      printWidth: 50,
      tabWidth: 2,
      singleQuote: true,
      trailingComma: "all",
      semi: true,
      htmlWhitespaceSensitivity: "ignore",
    });

    // Post-process: expand inline style="..." so each CSS property is on its own line
    result = expandInlineStyles(result);

    return result;
  } catch {
    // If formatting fails, return original code
    return code;
  }
}

/** Expands style="prop:val;prop:val" into multi-line with each property on its own line */
function expandInlineStyles(code: string): string {
  return code.replace(
    /style="([^"]+)"/g,
    (_match, styleContent: string) => {
      const props = styleContent
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);

      if (props.length <= 1) return _match; // no need to expand single property

      const indented = props.map((p) => `  ${p};`).join("\n");
      return `style="\n${indented}\n"`;
    },
  );
}

/** Auto-detect language from code content */
function detectLanguage(code: string): string {
  const trimmed = code.trim();

  // JSON: starts with { or [ and is valid JSON
  if (/^\s*[\[{]/.test(trimmed) && /[\]}]\s*$/.test(trimmed)) {
    try { JSON.parse(trimmed); return "json"; } catch { /* not json */ }
  }

  // TSX: has JSX tags + TypeScript type annotations
  if (/<\w+[\s/>]/.test(trimmed) && /(import |export |const |function |=>)/.test(trimmed)) {
    if (/(:\s*(string|number|boolean|React|Props|FC|JSX)|interface |<\w+>)/.test(trimmed)) return "tsx";
    return "jsx";
  }

  // TypeScript: type annotations, interfaces, generics (no JSX)
  if (/(interface \w|type \w.*=|:\s*(string|number|boolean|void|any|unknown|Promise)|<[A-Z]\w*>|as\s+\w)/.test(trimmed)
    && /(import |export |const |function |class )/.test(trimmed)) return "ts";

  // JavaScript: import/export/const/function but no type annotations
  if (/(import |export |require\(|module\.exports|const |let |var |function |=>)/.test(trimmed)) return "js";

  // HTML: starts with < tag (checked after JS/TS to avoid false match on JSX)
  if (/^\s*<(!doctype|html|head|body|div|span|p|a|button|input|form|table|ul|ol|li|h[1-6]|img|section|nav|footer|header|main|style|script|link|meta)/i.test(trimmed)) return "html";
  if (/^\s*<\w+[\s>]/.test(trimmed) && !/(import |export |const |function )/.test(trimmed)) return "html";

  // CSS: selectors with { } but not JS objects
  if (/^\s*(@media|@keyframes|@import|@font-face|[.#][a-zA-Z][\w-]*\s*\{|[a-z][\w-]*\s*\{[^:]*:)/m.test(trimmed)
    && !/(import |export |const |function |=>)/.test(trimmed)) return "css";

  // Bash: shebang or common shell commands
  if (/^#!/.test(trimmed) || /^(npm |npx |yarn |pip |apt |brew |sudo |echo |mkdir |chmod |curl |wget |git )/m.test(trimmed)) return "bash";

  // Python: def, class, print(), self.
  if (/(^def |^class |^from \w+ import|print\(|self\.)/m.test(trimmed)) return "python";

  // Default: keep current selection
  return "";
}

export function CodeBlockEditor({ block, onChange }: CodeBlockEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLTextAreaElement>(null);
  const [isFormatting, setIsFormatting] = useState(false);

  function autoResize(ref: React.RefObject<HTMLTextAreaElement | null>) {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => { autoResize(textareaRef); }, [block.content]);
  useEffect(() => { autoResize(previewRef); }, [block.codePreview]);

  const handleFormat = async () => {
    if (!block.content?.trim() || isFormatting) return;
    setIsFormatting(true);
    try {
      // Auto-detect language from content
      const detected = detectLanguage(block.content);
      const lang = detected || block.language || "tsx";

      const formatted = await formatCode(block.content, lang);

      // Single onChange call with both language + formatted content
      const updates: Partial<Block> = { content: formatted.trimEnd() };
      if (detected) {
        updates.language = detected;
      }
      onChange(updates);
    } finally {
      setIsFormatting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">

      {/* Language picker + Format button + Component picker */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={block.language ?? "tsx"}
          onChange={(e) => onChange({ language: e.target.value })}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-2.5 py-1.5 text-xs text-[var(--text-p)] focus:outline-none focus:border-[var(--border-hover)] cursor-pointer transition-colors duration-150"
        >
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>

        {getPrettierParser(block.language ?? "tsx") && (
          <button
            type="button"
            onClick={handleFormat}
            disabled={isFormatting || !block.content?.trim()}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-2.5 py-1.5 text-xs text-[var(--text-subtitle)] hover:text-[var(--text-title)] hover:border-[var(--border-hover)] focus:outline-none cursor-pointer transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10H7" /><path d="M21 6H3" /><path d="M21 14H3" /><path d="M21 18H7" />
            </svg>
            {isFormatting ? "Formatlanıyor…" : "Format"}
          </button>
        )}

        {/* Component Demo Picker next to Format button */}
        <select
          value={block.previewComponent ?? ""}
          onChange={(e) => {
            const key = e.target.value;
            const item = COMPONENT_REGISTRY[key];
            if (item) {
              onChange({
                previewComponent: key,
                content: item.sampleCode,
                language: "tsx",
              });
            } else {
              onChange({ previewComponent: "" });
            }
          }}
          className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-2.5 py-1.5 text-xs text-[var(--text-subtitle)] hover:text-[var(--text-title)] focus:outline-none focus:border-[var(--border-hover)] cursor-pointer transition-colors duration-150"
        >
          <option value="">🧩 Bileşen Seç (Opsiyonel)</option>
          {Object.values(COMPONENT_REGISTRY).map((item) => (
            <option key={item.key} value={item.key}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      {/* Code textarea */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-2)] overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[var(--border)]">
          <span className="w-2 h-2 rounded-full bg-[var(--border-hover)]" />
          <span className="w-2 h-2 rounded-full bg-[var(--border-hover)]" />
          <span className="w-2 h-2 rounded-full bg-[var(--border-hover)]" />
          <span className="ml-1.5 text-[10px] text-[var(--text-subtitle)] font-mono select-none">
            {block.language ?? "tsx"}
          </span>
        </div>
        <textarea
          ref={textareaRef}
          value={block.content ?? ""}
          onChange={(e) => {
            onChange({ content: e.target.value });
            autoResize(textareaRef);
          }}
          spellCheck={false}
          placeholder="// Kodunuzu buraya yazın…"
          rows={4}
          className="w-full resize-none overflow-hidden bg-transparent px-4 py-3 font-mono text-xs leading-6 text-[var(--text-p)] placeholder:text-[var(--text-subtitle)] focus:outline-none"
        />
      </div>

      {/* Preview HTML input */}
      <textarea
        ref={previewRef}
        value={block.codePreview ?? ""}
        onChange={(e) => {
          onChange({ codePreview: e.target.value });
          autoResize(previewRef);
        }}
        placeholder="Önizleme HTML — opsiyonel, Preview sekmesinde görünür"
        rows={3}
        className="w-full resize-none overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-1)] px-4 py-3 font-mono text-xs leading-6 text-[var(--text-p)] placeholder:text-[var(--text-subtitle)] focus:outline-none focus:border-[var(--border-hover)] transition-colors duration-150"
      />

      <BadgesEditor
        badges={block.badges ?? []}
        onChange={(badges) => onChange({ badges })}
      />
    </div>
  );
}
