# Architecture

## The parts

| Where | What |
|---|---|
| `src/app/` | the routes: the site (`/`, `/projects`, `/projects/[slug]`, `/cv`, `robots.ts`, `sitemap.ts`, `error.tsx`, `not-found.tsx`) and the admin (`/admin`, `/admin/projects`, `/admin/projects/[slug]`, its `/preview`, `/admin/cv`) |
| `src/figma/` | the project editor — a Figma clone — and the renderer the site uses for a project's page |
| `src/lib/` | data (`firestore.ts`), sign-in (`auth.ts`), files (`storage.ts`, `media.ts`), slugs, site settings |
| `src/components/` | the site's own UI (home, lists, lightboxes, navigation) and the admin's shared pieces (`admin/`) |
| `src/components/project/` | the design system's definitions: variables, text styles, interactions, rich text |
| `src/types/` | the stored shapes: projects, the design system, the CV |

## Data

All of it is in Firestore; `src/lib/firestore.ts` is the only module that reads or writes it.

| Document | What | Who reads |
|---|---|---|
| `projects/{slug}` | a project's fields and where it stands: `order`, `rev`, `published`, `changedSincePublish`, times | admin |
| `projects/{slug}/content/canvas` | its Figma file — the draft — as one JSON string (Firestore takes no maps nested past 20 levels) | admin |
| `projects/{slug}/versions/{id}` | its last 20 saves | admin |
| `published/{slug}` | the page the site shows, frozen when it was published: the page frame, the components it uses, the variables and text styles of the moment | anyone |
| `publishedIndex/{slug}` | the published project's summary — what the lists and prev/next read | anyone |
| `design/variables`, `design/textStyles`, `design/library` | the design system, shared by every project | admin |
| `cv/main` | the CV page | anyone |

A document holds at most 1 MiB: a save warns from 700 KB and refuses a file that won't fit.

**Writes happen only on Save** (or a project list's action — create, duplicate, delete, reorder, publish). An edit is never written on its own. A save writes everything it changed — the project, the variables, the text styles, the library — in one transaction. It is refused when one of them was saved elsewhere since it was read (each has a `rev`); the editor then offers Overwrite or Reload. Uploading a picture is the one immediate write: the file goes to Storage at once, and the draft refers to it only once saved.

**Storage** keeps uploads under `media/YYYY/MM/{time}-{name}.{ext}` (the CV's under `cv/…`). Pictures are made web-sized before they go up (at most 2560 px on the long side, as WebP — `src/lib/media.ts`). Files are public to read one by one. Listing, uploading and deleting are the admin's. Deleting a project leaves its files: the editor's Images panel finds the ones nothing uses any more (*Find unused*) and deletes them.

**Rules** (`firestore.rules`, `storage.rules`) allow the admin by a verified Google email. `ADMIN_EMAILS` in `src/lib/auth.ts` is the same list, for the UI.

## The editor

`/admin/projects/[slug]` opens `useEditSession` (`src/figma/session.ts`), which loads the project and the design system and holds what is being edited (`EditState`):

- **the file**: the project's own Figma file with the site's library put in as its Components page, and the library's effect styles (`withLibrary`). It is split back on save (`splitLibrary`).
- **the variables, the text styles**, and what was deleted of them and of the components (tombstones).

Undo and redo keep the last 20 states in memory (`src/components/admin/useUndo.ts`). A project that hasn't been changed has nothing to undo. *Dirty* is worked out by reference against what was last saved, so undoing back to it is clean again. Leaving with unsaved changes — closing the tab, the browser's back button, a link — asks first.

`FigmaEditor.tsx` is the shell: the toolbar, the panels, the keys, the menus. Around it:

| File | What |
|---|---|
| `model.ts` | the scene graph (frames, shapes, texts, components, sets, instances, properties, overrides, languages) and its pure operations |
| `Canvas.tsx` | the canvas: selection, move, resize, draw, the rulers, auto layout handles |
| `NodeView.tsx`, `css.ts` | a node drawn — the same on the canvas and on the site |
| `Inspector.tsx` | the right panel |
| `Layers.tsx`, `FindPanel.tsx`, `ImagesPanel.tsx`, `VariablesTable.tsx`, `VersionsWindow.tsx`, `SettingsWindow.tsx` | the other panels and windows |
| `library.ts` | the starting components and their upgrade signatures |
| `systemLibrary.ts`, `designSystem.ts` | the shared library, and deleting from the design system |
| `overview.ts`, `page.ts` | the project's page frame and its fixed Overview |
| `publish.ts` | what a published page is made of |
| `vectorSvg.ts`, `exportNode.ts`, `inline.ts` | Export and Copy as SVG/PNG/JPG |

### The page and its Overview

A project's site page is one top-level frame of its file (`pageId`), 1440 wide, its content in a 672 px column. Its first layer is the **Overview**: an instance of `c-overview`, marked `fixed`, that can't be deleted, moved or detached. What it says — title, category · year, description, cover — is the project's fields. They are read from it on save (`overviewFields`), and the lists, the metadata and the sitemap use them.

### The shared library

Components, variables and text styles belong to the site, not to a project (`design/library`, `design/variables`, `design/textStyles`). Every project's instances are of the same main components.

- **Upgrades** — the starting components ship with the code (`library.ts`). When the code's version is newer, a starting component nobody edited is replaced by its new shape (`currentLibrary`, by signature). One that was edited is kept.
- **Deleting** a component, a variable or a text style keeps a tombstone (`systemLibrary.ts`; the last 100 are kept). When a project that still uses it is opened, its uses become its own: an instance becomes a plain frame, and a bound value becomes the value it had, as if set by hand (`detachDeleted`).

## Publishing

Publish saves first, then freezes the page (`publishedPage`): the page frame, the components it uses and the ones those use, the pictures' alt text (the cover's defaults to the title), and the variables and text styles of the moment. One batch writes `published/{slug}`, `publishedIndex/{slug}` and the project's `published` / `changedSincePublish`.

The site reads only the published documents, through ISR (`revalidate = 60`; the sitemap hourly):

- `/projects/[slug]` — `generateStaticParams` from the index; `notFound()` for an unknown or unpublished slug; metadata (description, canonical, Open Graph, Twitter) and JSON-LD from the summary; prev/next by `order`.
- The page is drawn by `PageView` / `NodeView` in site mode: texts as `h1`/`h2`/`h3`/`p` (each text's tag), pictures lazy with the cover eager, click reactions as keyboard-reachable buttons, `prefers-reduced-motion` respected.
- **Narrow screens** — the page sits in a CSS container (`container: page`). The same rules apply on the site and in the Page Editor's preview widths (`PAGE_CSS` in `NodeView.tsx`):
  - below 1280 px (nothing beside the page) its top room shrinks to 40 px
  - frames marked *narrow* stack their layers below 768 px (`stack`) or 640 px (`stack-sm`), or keep two columns (`two`)
  - below 640 px an unmarked grid of three or more columns has two, and fixed widths may shrink to the screen
- **Languages** — Turkish is the base. A page offers the languages it has words in (`writtenLanguages`). The one shown comes from `?lang=`, else the visitor's last choice, else Turkish.

A change to the library or the variables reaches a published page only when that page is republished.

## Export

Copy as SVG and Export (SVG, PNG, JPG) are made from the layer's vectors (`vectorSvg.ts`), read from what the canvas drew:

- boxes become rects and paths — fills, gradients, pictures, strokes, shadows, corners, clips, turns
- texts become `<text>`, one per line where the canvas broke them
- the fonts are embedded (only the faces used)

PNG and JPG draw that SVG to a canvas. An SVG holding the HTML in a `foreignObject` would taint the canvas in Chrome and Safari, so no PNG could be made from it. Pictures the bucket won't let the page read (no CORS rule, see `cors.json`) are linked in an SVG and blank in a PNG; the editor says how many.

## Checks

`npm run check` runs the types, the lint and the tests. The tests are pure: the model, the shared library and deleting from it, slugs, arithmetic in number fields. CI (`.github/workflows/ci.yml`) runs them and a production build on every push and pull request.
