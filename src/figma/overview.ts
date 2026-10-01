import type { ProjectData } from "@/types/project";
import { withStartingLibrary } from "./library";
import {
  OVERVIEW_NAME,
  inPageColumn,
  overviewContent,
  overviewFor,
  pageFrameOf,
  sitePageFrame,
  withProjectPage,
  type OverviewContent,
} from "./fromLegacy";
import {
  findComponent,
  insertNode,
  isFrameLike,
  libraryOf,
  newDocument,
  propertiesOf,
  removeNodes,
  resolveInstance,
  upgradeDocument,
  walk,
  type FigmaDocument,
  type FixedPart,
  type FrameNode,
  type SceneNode,
  type ShapeNode,
  type TextNode,
} from "./model";

/**
 * The page's Overview — the project's title, its category and year, its
 * description and cover — as the page frame's first layer, on every
 * project's page: an instance of the Overview component (c-overview, on the
 * Components page), made with a new project's page, the template's example
 * in it to fill in (see fromLegacy's Missing).
 *
 *  - Its look is the component's: edited on the component (Go to main
 *    component), it changes the page's overview. Its words are the
 *    instance's text properties, its parts shown or not by its booleans
 *    (Subtitle, Description, Cover), its picture the instance's fill of the
 *    Cover's Image.
 *  - The instance and the component's parts are marked as the project's
 *    (SceneNode.fixed): they can't be deleted, moved out of their place,
 *    wrapped, unwrapped, detached or renamed — the editor's actions leave
 *    them out, and any change that would break the overview is refused
 *    (keepsOverview).
 *  - Saved, it is the project's own fields (overviewFields): what the
 *    projects' list, the cards and the page's title read. A subtitle, a
 *    description or a cover not shown is none.
 */

/** Each part's parent part. */
const PARENT: Record<FixedPart, FixedPart | null> = {
  overview: null,
  header: "overview",
  title: "header",
  subtitle: "header",
  description: "overview",
  cover: "overview",
  image: "cover",
};
const PARTS = Object.keys(PARENT) as FixedPart[];

/** The parts that stay in sight: the project's title, over its header. (The others not shown: the project has none of them.) */
const ALWAYS_SHOWN = ["header", "title"] as const;

export interface OverviewParts {
  /** The page's instance */
  instance: FrameNode;
  /** It, resolved: what it draws, its parts the component's */
  overview: FrameNode;
  header: FrameNode;
  title: TextNode;
  subtitle: TextNode;
  description: TextNode;
  cover: FrameNode;
  image: ShapeNode;
}

/** Is the layer the kind its part is? */
const fits = (part: FixedPart, node: SceneNode) =>
  part === "title" || part === "subtitle" || part === "description" ? node.type === "text" : part === "image" ? node.type === "rectangle" : node.type === "frame";

const found = new WeakMap<FigmaDocument, OverviewParts | null>();

/**
 * The page's overview, part by part — null when it isn't whole: the page
 * frame's first layer not the marked instance, its component gone, a part
 * of it missing, out of its place, of another kind or there twice, or its
 * words and parts no longer the instance's to set (a text not bound to its
 * text property, a part not shown by its boolean).
 */
export function overviewOf(doc: FigmaDocument): OverviewParts | null {
  if (!found.has(doc)) found.set(doc, partsOf(doc));
  return found.get(doc)!;
}

function partsOf(doc: FigmaDocument): OverviewParts | null {
  const first = pageFrameOf(doc)?.children[0];
  if (!first || first.fixed !== "overview" || first.type !== "instance" || !first.mainId) return null;
  const lib = libraryOf(doc);
  const overview = resolveInstance(lib, first);
  if (!overview || overview.fixed !== "overview") return null;
  const parts: Partial<Record<FixedPart, SceneNode>> = { overview };
  let whole = true;
  walk(overview.children, (node, parent) => {
    if (!node.fixed) return;
    if (parts[node.fixed] || !fits(node.fixed, node) || parent?.fixed !== PARENT[node.fixed]) whole = false;
    else parts[node.fixed] = node;
  }, overview);
  if (!whole || !PARTS.every((p) => parts[p])) return null;
  const o = { ...parts, instance: first } as OverviewParts;
  const properties = propertiesOf(lib, first.mainId);
  const has = (id: string | undefined, type: "text" | "boolean") => properties.some((p) => p.id === id && p.type === type);
  const bound =
    has(o.title.charactersProp, "text") &&
    has(o.subtitle.charactersProp, "text") && has(o.subtitle.visibleProp, "boolean") &&
    has(o.description.charactersProp, "text") && has(o.description.visibleProp, "boolean") &&
    has(o.cover.visibleProp, "boolean");
  return bound ? o : null;
}

/**
 * The ids of the layers that stay: the site's page frame, the overview's
 * instance, the component it is an instance of and that component's parts
 * (another variant of it, not in use, goes as any).
 */
export function fixedIds(doc: FigmaDocument): ReadonlySet<string> {
  const ids = new Set<string>();
  if (pageFrameOf(doc)) ids.add(doc.pageId);
  const o = overviewOf(doc);
  const main = o?.instance.mainId ? findComponent(libraryOf(doc), o.instance.mainId) : null;
  if (!o || !main) return ids;
  ids.add(o.instance.id);
  walk([main], (node) => {
    if (node.fixed) ids.add(node.id);
  });
  return ids;
}

/**
 * Does the change from `before` to `after` keep the overview — the same
 * instance, the page frame's first, in sight, every part of its component
 * in its place, the title shown? (Nothing to keep when `before` had none
 * whole.)
 */
export function keepsOverview(before: FigmaDocument, after: FigmaDocument): boolean {
  if (before.nodes === after.nodes && before.pages === after.pages && before.pageId === after.pageId) return true;
  const was = overviewOf(before);
  if (!was) return true;
  const now = overviewOf(after);
  if (!now) return false;
  return now.instance.id === was.instance.id && now.instance.visible !== false && ALWAYS_SHOWN.every((p) => now[p].visible !== false);
}

// ── The overview made whole ───────────────────────────────────────────────────

/** Without the project's mark, anywhere in it. */
function unmarked(node: SceneNode): SceneNode {
  const own = { ...node };
  delete own.fixed;
  return isFrameLike(own) ? { ...own, children: own.children.map(unmarked) } : own;
}

const isText = (node: SceneNode): node is TextNode => node.type === "text";
const shown = (node?: SceneNode) => Boolean(node && node.visible !== false);
const said = (s?: string | null): s is string => Boolean(s && s.trim());

/** An older overview's header: a frame named so, or the first frame of texts only. */
const headerOf = (frame: FrameNode) =>
  frame.children.find((c): c is FrameNode => c.type === "frame" && c.name === "Header") ??
  frame.children.find((c): c is FrameNode => c.type === "frame" && c.children.length > 0 && c.children.every(isText));

/** Is it the overview an older page was made with (see withLegacyPage) — a frame named so, its header in it? */
const isOlderOverview = (node: SceneNode): node is FrameNode => node.type === "frame" && node.name === OVERVIEW_NAME && Boolean(headerOf(node));

/**
 * What an older page's overview (a frame of its own, made before it was the
 * component's) says, its parts known by their text styles, then their
 * place: the header's title and subtitle, the description, the cover's
 * picture. What it lacks, the project's fields say. A description is there
 * as the page showed it; a subtitle and a cover — the projects' list shows
 * them too — whenever either has one. What else the frame held (layers of
 * the user's own) is `kept`: the frame without its parts.
 */
function olderContent(frame: FrameNode, project: ProjectData): { content: OverviewContent; kept: FrameNode | null } {
  const fields = overviewContent(project, "hidden");
  const header = headerOf(frame);
  const texts = header?.children.filter(isText) ?? [];
  const title = texts.find((t) => t.textStyle === "section-title") ?? texts[0];
  const subtitle = texts.find((t) => t !== title && t.textStyle === "subtitle") ?? texts.find((t) => t !== title);
  const own = frame.children.filter(isText);
  const description = own.find((t) => t.textStyle === "text") ?? own[0];
  const cover = frame.children.find((c): c is FrameNode => c.type === "frame" && c.name === "Cover");
  const image = cover?.children.find((c): c is ShapeNode => c.type === "rectangle");
  const url = image?.fills.find((p) => p.type === "image" && p.image?.url)?.image?.url;
  const used = new Set<SceneNode | undefined>([title, subtitle, description, image]);
  const rest = frame.children.flatMap((c): SceneNode[] => {
    if (used.has(c)) return [];
    if (c !== header && c !== cover) return [c];
    const inner = c.children.filter((x) => !used.has(x));
    return inner.length ? [{ ...c, children: inner }] : [];
  });
  const kept = rest.length ? { ...frame, name: `${OVERVIEW_NAME} (kept)`, children: rest } : null;
  const content: OverviewContent = {
    title: title?.characters.trim() || fields.title,
    titleEn: title?.charactersEn?.trim() || fields.titleEn,
    subtitle: subtitle?.characters.trim() || fields.subtitle,
    subtitleShown: (shown(subtitle) && said(subtitle?.characters)) || fields.subtitleShown,
    description: description?.characters.trim() || fields.description,
    descriptionEn: description?.charactersEn?.trim() || fields.descriptionEn,
    descriptionShown: shown(description) && said(description?.characters),
    cover: url || fields.cover,
    coverShown: (shown(cover) && shown(image) && said(url)) || fields.coverShown,
  };
  return { content, kept };
}

/** Is it an instance of the Overview component (a variant of it too)? */
const isOverviewInstance = (lib: readonly SceneNode[], node: SceneNode) =>
  node.type === "instance" && Boolean(node.mainId && findComponent(lib, node.mainId)?.fixed === "overview");

/**
 * The file with its page's overview whole (see overviewOf): kept as it is
 * when it is; on an empty page — a new project's — the site's page made, its
 * overview the template's example to fill in; otherwise the instance there
 * (marked, or the page's first) put first and marked — or, on a page made
 * from an older one, its overview of its own made the component's — or a new
 * one, from the project's fields. Nothing else on the page keeps a mark. A
 * page frame isn't made where there is none, nor an overview without its
 * component.
 */
export function withOverview(doc: FigmaDocument, project: ProjectData): FigmaDocument {
  const page = pageFrameOf(doc);
  if (!page || overviewOf(doc)) return doc;
  if (!page.children.length) {
    const made = sitePageFrame(page, project, [inPageColumn(overviewFor(doc, overviewContent(project, "sample")), project)]);
    return keep(doc, { ...doc, nodes: doc.nodes.map((n) => (n.id === page.id ? made : n)) });
  }
  const lib = libraryOf(doc);
  const kids = page.children;
  let at = kids.findIndex((c) => c.fixed === "overview" && isOverviewInstance(lib, c));
  if (at < 0 && isOverviewInstance(lib, kids[0])) at = 0;
  // What leads the page: the overview, then — an older one's layers of the user's own — what else it held.
  let lead: SceneNode[];
  if (at >= 0) {
    lead = [{ ...kids[at], fixed: "overview", name: OVERVIEW_NAME, visible: undefined }];
  } else {
    at = kids.findIndex((c) => (c.type === "frame" && c.fixed === "overview") || (Boolean(doc.fromLegacy) && isOlderOverview(c)));
    const older = at >= 0 ? olderContent(kids[at] as FrameNode, project) : null;
    const made = inPageColumn(overviewFor(doc, older?.content ?? overviewContent(project, "hidden")), project);
    lead = older?.kept ? [made, older.kept] : [made];
  }
  const rest = kids.filter((_, i) => i !== at);
  return keep(doc, { ...doc, nodes: doc.nodes.map((n) => (n.id === page.id ? { ...page, children: [...lead, ...rest].map((c, i) => (i === 0 ? c : unmarked(c))) } : n)) });
}

/** `next` when its overview is whole — else the file as it was. */
const keep = (doc: FigmaDocument, next: FigmaDocument) => (overviewOf(next) ? next : doc);

/**
 * The project with its Figma file — a new one when it has none yet (its page
 * frame named after it) — the starting components on their page (the
 * Overview's among them), its page made from its older page while it waits
 * for it (see withProjectPage), its overview whole (withOverview).
 */
export function withProjectCanvas(project: ProjectData): ProjectData {
  const canvas = withStartingLibrary(project.canvas ? upgradeDocument(project.canvas) : newDocument(project.title || project.slug));
  return { ...project, canvas: withOverview(withProjectPage(canvas, project), project) };
}

/**
 * Another top-level frame as the site's page ("Set as site page"): the
 * overview goes with it, its first layer. When the frame leads with a copy
 * of it (a copy of the page), the overview takes the copy's place and what
 * the copy says. Into anything but a plain frame it can't: the page stays.
 */
export function withSitePage(doc: FigmaDocument, id: string): FigmaDocument {
  if (id === doc.pageId) return doc;
  const target = doc.nodes.find((n) => n.id === id);
  const parts = overviewOf(doc);
  if (!parts) return target ? { ...doc, pageId: id } : doc;
  if (!target || target.type !== "frame") return doc;
  const lead = target.children[0];
  const copy = lead && !lead.fixed && isOverviewInstance(libraryOf(doc), lead) ? (lead as FrameNode) : null;
  const moved: FrameNode = copy ? { ...parts.instance, mainId: copy.mainId, props: copy.props, propsEn: copy.propsEn, overrides: copy.overrides } : parts.instance;
  const gone = new Set([parts.instance.id, ...(copy ? [copy.id] : [])]);
  return { ...doc, pageId: id, nodes: insertNode(removeNodes(doc.nodes, gone), id, moved, 0) };
}

// ── The project's fields ──────────────────────────────────────────────────────

export type OverviewFields = Required<Pick<ProjectData, "title" | "titleEn" | "category" | "year" | "description" | "descriptionEn" | "coverImage">>;

/** A year, or a span of them ("2024", "2024–2025"). */
const YEAR = /^\d{4}(\s*[-–]\s*\d{2,4})?$/;

/** "UX / UI Design · 2026" as its category and its year — the year the part after the last "·", when it is one. */
function categoryAndYear(subtitle: string): [category: string, year: string] {
  const at = subtitle.lastIndexOf("·");
  const last = (at < 0 ? subtitle : subtitle.slice(at + 1)).trim();
  if (!YEAR.test(last)) return [subtitle.trim(), ""];
  return [at < 0 ? "" : subtitle.slice(0, at).trim(), last];
}

/** What the overview says, as the project's fields — null when the page has no whole overview. A part not shown says nothing. */
export function overviewFields(doc: FigmaDocument): OverviewFields | null {
  const o = overviewOf(doc);
  if (!o) return null;
  const [category, year] = categoryAndYear(shown(o.subtitle) ? o.subtitle.characters : "");
  const described = shown(o.description) && said(o.description.characters);
  const picture = shown(o.cover) && shown(o.image) ? o.image.fills.find((p) => p.visible !== false && p.type === "image" && p.image?.url) : undefined;
  return {
    title: o.title.characters.trim(),
    titleEn: o.title.charactersEn?.trim() ?? "",
    category,
    year,
    description: described ? o.description.characters.trim() : "",
    descriptionEn: described ? o.description.charactersEn?.trim() ?? "" : "",
    coverImage: picture?.image?.url ?? "",
  };
}

/** The project with its fields as its page's overview says (see overviewFields) — as it is when it has none. */
export function withOverviewFields(project: ProjectData): ProjectData {
  const fields = project.canvas ? overviewFields(project.canvas) : null;
  return fields ? { ...project, ...fields } : project;
}
