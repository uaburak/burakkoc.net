"use client";

import { useEffect, useRef } from "react";
import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-css";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-python";
import "prismjs/components/prism-sql";

interface CodeHighlightProps {
  code: string;
  language?: string;
  className?: string;
}

export function CodeHighlight({ code, language = "javascript", className = "" }: CodeHighlightProps) {
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [code, language]);

  // Map common alias names to Prism supported grammars
  const langMap: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    py: "python",
    rules: "javascript",
    sh: "bash",
    html: "jsx",
  };
  const normalizedLang = langMap[language.toLowerCase()] || language.toLowerCase();

  return (
    <div className={`w-full h-full overflow-auto custom-code-scroll ${className}`}>
      <pre className="font-mono text-xs sm:text-sm leading-6 text-[var(--text-p)] whitespace-pre p-5 sm:p-6 m-0 min-w-full inline-block">
        <code ref={codeRef} className={`language-${normalizedLang} inline-block min-w-full pb-2`}>
          {code}
        </code>
      </pre>
    </div>
  );
}
