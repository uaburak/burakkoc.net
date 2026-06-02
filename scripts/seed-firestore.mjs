/**
 * Firestore Seed Script
 * Run with: node scripts/seed-firestore.mjs
 *
 * Populates the "projects" collection with 5 realistic projects,
 * matching the exact shape written by the admin panel (saveProject).
 */

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

// ── Firebase config ────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyDxG-Rh5V2AFWD2JeP43jzpET1nXuER5zs",
  authDomain:        "burakkoc-a15d3.firebaseapp.com",
  projectId:         "burakkoc-a15d3",
  storageBucket:     "burakkoc-a15d3.firebasestorage.app",
  messagingSenderId: "957278625176",
  appId:             "1:957278625176:web:a0f9a7add2c60c40e21fed",
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── Helper: write one project ─────────────────────────────────────────────────
async function saveProject(data) {
  const ref = doc(db, "projects", data.slug);
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() });
  console.log(`✓  Saved: ${data.slug}`);
}

// ── Project data ──────────────────────────────────────────────────────────────

const projects = [

  // ── 1. Portfolio Website ──────────────────────────────────────────────────
  {
    slug:     "portfolio-website",
    title:    "Portfolio Website",
    category: "Web · Design",
    year:     "2024",
    items: [
      {
        id:   "section-overview",
        kind: "section",
        blocks: [
          {
            id:      "b1",
            type:    "text",
            content: "A personal portfolio built with Next.js 16, TypeScript, and Firebase. The site features a custom CMS (admin panel) that lets me manage projects in real-time without redeployment. Content is stored in Firestore and streamed directly to the client.",
          },
          {
            id:          "b2",
            type:        "image",
            src:         "https://images.unsplash.com/photo-1547658719-da2b51169166?w=1880&q=80",
            alt:         "Portfolio homepage screenshot",
            caption:     "Landing page — dark mode default",
            aspectRatio: "16/9",
            badges: [
              {
                id:       "badge-ext",
                icon:     "external",
                position: "top-right",
                href:     "https://burakkoc.net",
              },
            ],
          },
        ],
      },
      { id: "divider-1", kind: "divider" },
      {
        id:   "section-stack",
        kind: "section",
        blocks: [
          { id: "b3", type: "heading",    content: "Tech Stack" },
          { id: "b4", type: "subheading", content: "Next.js 16 · TypeScript · Firebase · GSAP · Tailwind CSS v4" },
          {
            id:      "b5",
            type:    "text",
            content: "The project is structured as an App Router application. Each route is either a React Server Component (for SEO) or a lightweight Client Component that hydrates Firebase data.\n\nGSAP ScrollSmoother adds the buttery scroll feel while TextScrollingEffect animates headings as they enter the viewport. Theme toggling uses CSS custom properties — no re-renders, no flash.",
          },
          {
            id:          "b6",
            type:        "code",
            language:    "tsx",
            content:     `// loadProject — Firestore client helper
export async function loadProject(slug: string) {
  const ref  = doc(db, "projects", slug);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as ProjectData;
}`,
          },
        ],
      },
      { id: "divider-2", kind: "divider" },
      {
        id:   "section-design",
        kind: "section",
        blocks: [
          { id: "b7", type: "heading", content: "Design System" },
          {
            id:      "b8",
            type:    "text",
            content: "All colors are CSS custom properties on :root, toggled by a `data-theme` attribute. This allows instant theme switching without a page reload or hydration mismatch.",
          },
          {
            id:          "b9",
            type:        "image",
            src:         "https://images.unsplash.com/photo-1558655146-d09347e92766?w=1880&q=80",
            alt:         "Design tokens",
            caption:     "Color token reference — light & dark",
            aspectRatio: "16/9",
          },
        ],
      },
    ],
  },

  // ── 2. Motion UI Library ──────────────────────────────────────────────────
  {
    slug:     "motion-ui",
    title:    "Motion UI Library",
    category: "Open Source · Frontend",
    year:     "2024",
    items: [
      {
        id:   "section-intro",
        kind: "section",
        blocks: [
          {
            id:      "b1",
            type:    "text",
            content: "A zero-dependency animation library for React built on the Web Animations API. Ships 12 composable hooks (useSpring, useDrag, useParallax…) with full TypeScript types and tree-shaking support.",
          },
          {
            id:          "b2",
            type:        "image",
            src:         "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1880&q=80",
            alt:         "Motion UI demo",
            caption:     "Interactive drag-and-spring demo",
            aspectRatio: "16/9",
            badges: [
              {
                id:         "seg-1",
                icon:       "segmented",
                position:   "top-right",
                tab1Label:  "Preview",
                tab2Label:  "Code",
                tab2: {
                  type:    "code",
                  content: `import { useSpring } from "@motion-ui/react";

function Card() {
  const [style, api] = useSpring({ scale: 1, y: 0 });

  return (
    <animated.div
      style={style}
      onMouseEnter={() => api.start({ scale: 1.05, y: -4 })}
      onMouseLeave={() => api.start({ scale: 1, y: 0 })}
    />
  );
}`,
                },
              },
            ],
          },
        ],
      },
      { id: "divider-1", kind: "divider" },
      {
        id:   "section-arch",
        kind: "section",
        blocks: [
          { id: "b3", type: "heading",    content: "Architecture" },
          { id: "b4", type: "subheading", content: "Web Animations API · React hooks · Rollup bundler" },
          {
            id:      "b5",
            type:    "text",
            content: "Each hook wraps the browser-native Web Animations API, deferring to GPU-composited transforms where possible. The spring physics engine is a single 80-line Runge-Kutta integrator — no external dependency.",
          },
          {
            id:       "b6",
            type:     "code",
            language: "ts",
            content:  `// Runge-Kutta 4 spring integrator
function rk4(pos: number, vel: number, dt: number, config: SpringConfig) {
  const { stiffness, damping, mass } = config;
  const a = (target: number) =>
    (-stiffness * (pos - target) - damping * vel) / mass;
  const k1v = a(0),       k1x = vel;
  const k2v = a(-k1x * dt / 2), k2x = vel + k1v * dt / 2;
  const k3v = a(-k2x * dt / 2), k3x = vel + k2v * dt / 2;
  const k4v = a(-k3x * dt),     k4x = vel + k3v * dt;
  return {
    pos: pos + (dt / 6) * (k1x + 2*k2x + 2*k3x + k4x),
    vel: vel + (dt / 6) * (k1v + 2*k2v + 2*k3v + k4v),
  };
}`,
          },
        ],
      },
      { id: "divider-2", kind: "divider" },
      {
        id:   "section-perf",
        kind: "section",
        blocks: [
          { id: "b7", type: "heading", content: "Performance" },
          {
            id:      "b8",
            type:    "text",
            content: "All animations run on the compositor thread — zero JS jank during scroll. Bundle size is 3.2 kB gzipped. The library ships separate CJS and ESM builds so bundlers can tree-shake unused hooks.",
          },
        ],
      },
    ],
  },

  // ── 3. AI Image Tagger ────────────────────────────────────────────────────
  {
    slug:     "ai-image-tagger",
    title:    "AI Image Tagger",
    category: "AI · Full-Stack",
    year:     "2023",
    items: [
      {
        id:   "section-overview",
        kind: "section",
        blocks: [
          {
            id:      "b1",
            type:    "text",
            content: "A web app that automatically tags and categorises photos using Gemini Vision. Users drag-and-drop images; the backend returns semantic tags, dominant colors, and a one-sentence caption — all within ~800 ms.",
          },
          {
            id:          "b2",
            type:        "image",
            src:         "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=1880&q=80",
            alt:         "AI tagger interface",
            caption:     "Drag-and-drop upload with live results panel",
            aspectRatio: "16/9",
            badges: [
              {
                id:       "badge-link",
                icon:     "external",
                position: "top-right",
                href:     "https://github.com",
              },
            ],
          },
        ],
      },
      { id: "divider-1", kind: "divider" },
      {
        id:   "section-pipeline",
        kind: "section",
        blocks: [
          { id: "b3", type: "heading",    content: "Processing Pipeline" },
          { id: "b4", type: "subheading", content: "Next.js Route Handler · Gemini Pro Vision · Cloud Storage" },
          {
            id:      "b5",
            type:    "text",
            content: "1. Image is uploaded to a presigned Cloud Storage URL directly from the browser.\n2. A Next.js Route Handler triggers a Gemini multimodal request with the GCS URI.\n3. Gemini returns structured JSON (tags, colors, caption) validated with Zod.\n4. Results are stored in Firestore and streamed to the client via SSE.",
          },
          {
            id:       "b6",
            type:     "code",
            language: "ts",
            content:  `// Route Handler — POST /api/tag
export async function POST(req: Request) {
  const { gcsUri } = await req.json();

  const result = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      { role: "user", parts: [
        { fileData: { mimeType: "image/jpeg", fileUri: gcsUri } },
        { text: "Return JSON: { tags: string[], colors: string[], caption: string }" },
      ]},
    ],
  });

  const parsed = TagSchema.parse(JSON.parse(result.text));
  return Response.json(parsed);
}`,
          },
        ],
      },
      { id: "divider-2", kind: "divider" },
      {
        id:   "section-results",
        kind: "section",
        blocks: [
          { id: "b7", type: "heading", content: "Results" },
          {
            id:      "b8",
            type:    "text",
            content: "Tested on 2 000 stock images across 40 categories. Tagging accuracy: 94.3 % top-5. Average latency: 810 ms (p95: 1 400 ms). Cost per image: $0.0004 using Gemini Flash.",
          },
          {
            id:          "b9",
            type:        "image",
            src:         "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1880&q=80",
            alt:         "Results chart",
            caption:     "Accuracy by category — top-5 recall",
            aspectRatio: "4/3",
          },
        ],
      },
    ],
  },

  // ── 4. Real-time Dashboard ────────────────────────────────────────────────
  {
    slug:     "realtime-dashboard",
    title:    "Real-time Analytics Dashboard",
    category: "Web · Data Viz",
    year:     "2023",
    items: [
      {
        id:   "section-overview",
        kind: "section",
        blocks: [
          {
            id:      "b1",
            type:    "text",
            content: "A live analytics dashboard for a SaaS platform serving 50 k daily active users. Metrics update every second via WebSocket. Built with React, D3.js, and a Go backend.",
          },
          {
            id:          "b2",
            type:        "image",
            src:         "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1880&q=80",
            alt:         "Dashboard overview",
            caption:     "Main dashboard — sessions, revenue, retention",
            aspectRatio: "16/9",
            badges: [
              {
                id:         "seg-1",
                icon:       "segmented",
                position:   "top-right",
                tab1Label:  "Live",
                tab2Label:  "Schema",
                tab2: {
                  type:    "code",
                  content: `type Event = {
  id:        string;
  userId:    string;
  type:      "pageview" | "click" | "conversion";
  sessionId: string;
  timestamp: number;   // Unix ms
  properties: Record<string, string | number | boolean>;
};`,
                },
              },
            ],
          },
        ],
      },
      { id: "divider-1", kind: "divider" },
      {
        id:   "section-charts",
        kind: "section",
        blocks: [
          { id: "b3", type: "heading",    content: "Visualisations" },
          { id: "b4", type: "subheading", content: "D3.js · Canvas API · WebGL for large datasets" },
          {
            id:      "b5",
            type:    "text",
            content: "Line charts and area charts are rendered with D3. For datasets exceeding 100 k points the chart switches to a WebGL canvas renderer (regl) to maintain 60 fps. All transitions are 300 ms ease-out.",
          },
          {
            id:          "b6",
            type:        "image",
            src:         "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=1880&q=80",
            alt:         "Charts view",
            caption:     "Funnel analysis — conversion by cohort",
            aspectRatio: "16/9",
          },
        ],
      },
      { id: "divider-2", kind: "divider" },
      {
        id:   "section-backend",
        kind: "section",
        blocks: [
          { id: "b7", type: "heading", content: "Backend" },
          {
            id:      "b8",
            type:    "text",
            content: "Events are ingested via a Go service into ClickHouse. Aggregations run as materialised views — no on-the-fly GROUP BY queries. The WebSocket server fans out pre-computed JSON diffs to connected clients.",
          },
          {
            id:       "b9",
            type:     "code",
            language: "go",
            content:  `// Fanout loop — broadcasts pre-aggregated metrics
func (h *Hub) run() {
  ticker := time.NewTicker(time.Second)
  for range ticker.C {
    metrics := h.store.LatestSnapshot()
    payload, _ := json.Marshal(metrics)
    h.mu.RLock()
    for conn := range h.clients {
      conn.WriteMessage(websocket.TextMessage, payload)
    }
    h.mu.RUnlock()
  }
}`,
          },
        ],
      },
    ],
  },

  // ── 5. Design System CLI ──────────────────────────────────────────────────
  {
    slug:     "design-system-cli",
    title:    "Design System CLI",
    category: "Tooling · DX",
    year:     "2024",
    items: [
      {
        id:   "section-overview",
        kind: "section",
        blocks: [
          {
            id:      "b1",
            type:    "text",
            content: "A command-line tool that scaffolds design-system tokens (colors, spacing, typography) from a Figma file URL into ready-to-use CSS custom properties, Tailwind config, and TypeScript constants — in one command.",
          },
          {
            id:          "b2",
            type:        "image",
            src:         "https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=1880&q=80",
            alt:         "CLI output",
            caption:     "Terminal output after running `ds-cli sync`",
            aspectRatio: "16/9",
            badges: [
              {
                id:       "badge-gh",
                icon:     "external",
                position: "top-right",
                href:     "https://github.com",
              },
            ],
          },
        ],
      },
      { id: "divider-1", kind: "divider" },
      {
        id:   "section-usage",
        kind: "section",
        blocks: [
          { id: "b3", type: "heading",    content: "Usage" },
          { id: "b4", type: "subheading", content: "Node.js · Figma REST API · Ink (React for CLIs)" },
          {
            id:       "b5",
            type:     "code",
            language: "bash",
            content:  `# Install once
npm i -g @burakkoc/ds-cli

# Sync tokens from a Figma file
ds-cli sync --figma-url "https://figma.com/file/abc123" \\
            --out ./src/tokens \\
            --format css,tailwind,ts

# Output:
# ✓  src/tokens/tokens.css       (48 variables)
# ✓  src/tokens/tailwind.js      (extended theme)
# ✓  src/tokens/index.ts         (typed constants)`,
          },
          {
            id:      "b6",
            type:    "text",
            content: "The CLI reads Figma's local styles via the REST API, maps each color/text style to a semantic token name, and writes three output formats simultaneously. A `--watch` flag re-syncs on every Figma publish event via webhook.",
          },
        ],
      },
      { id: "divider-2", kind: "divider" },
      {
        id:   "section-internals",
        kind: "section",
        blocks: [
          { id: "b7", type: "heading", content: "Internals" },
          {
            id:      "b8",
            type:    "text",
            content: "The token mapper uses a naming heuristic: `Primary/500` → `--color-primary-500`. Aliases (e.g., `Background/Default → Primary/50`) are preserved as CSS `var()` references so changes cascade automatically.",
          },
          {
            id:       "b9",
            type:     "code",
            language: "ts",
            content:  `// Token mapper — Figma style → CSS var name
function toVarName(figmaName: string): string {
  return "--" + figmaName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/\//g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

// Resolve aliases
function resolveAlias(token: Token, map: Map<string, Token>): string {
  if (token.alias) {
    const target = map.get(token.alias);
    if (target) return \`var(\${toVarName(target.name)})\`;
  }
  return token.value;
}`,
          },
          {
            id:          "b10",
            type:        "image",
            src:         "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=1880&q=80",
            alt:         "Token mapping diagram",
            caption:     "Figma style tree → CSS custom property hierarchy",
            aspectRatio: "16/9",
          },
        ],
      },
    ],
  },

];

// ── Run ────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\nSeeding ${projects.length} projects into Firestore…\n`);
  for (const project of projects) {
    await saveProject(project);
  }
  console.log("\n✅  All projects seeded successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌  Seed failed:", err);
  process.exit(1);
});
