import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ProjectData } from "@/types/project";
import type { CanvasNode, DesignComponent, DesignVariable, TextStyle } from "@/types/design";
import { componentsFromLegacy, type LegacyDesigns, type LegacyMolecule } from "@/components/project/legacyDesign";
import { normalizeItems } from "@/lib/projectLayout";

import { CVData } from "@/types/cv";

const COLLECTION = "projects";
const CV_COLLECTION = "cv";
const CV_DOC_ID = "main";

export const DEFAULT_CV_DATA: CVData = {
  myname: "",
  myrole: "",
  profileImage: "",
  aboutParagraphs: [],
  experience: [],
  education: [],
  skillsList: [],
  hobbies: [],
  contact: [],
  cvPdfUrl: "",
  cvPreviewImage: "",
};

// ── Undefined Cleaner Helper ──────────────────────────────────────────────────

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const result: any = Array.isArray(obj) ? [] : {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val === undefined) continue;
    if (val !== null && typeof val === "object" && !(val instanceof Timestamp)) {
      result[key] = stripUndefined(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

// ── Normalization Helper ──────────────────────────────────────────────────────

function normalizeProjectData(raw: Record<string, unknown>): ProjectData {
  const cleaned = { ...raw };
  if (cleaned.updatedAt instanceof Timestamp) delete cleaned.updatedAt;
  if (cleaned.createdAt instanceof Timestamp) delete cleaned.createdAt;

  let items: any[] = Array.isArray(cleaned.items) ? cleaned.items : [];
  if (!items.length && Array.isArray(cleaned.sections)) {
    items = cleaned.sections.map((sec: any) => ({ ...sec, kind: "section" }));
  }

  // Sections saved before groups (Blok) existed get one; see normalizeSection.
  const validItems = normalizeItems(items);

  const res: ProjectData = {
    slug: String(cleaned.slug || ""),
    title: String(cleaned.title || ""),
    category: String(cleaned.category || ""),
    year: String(cleaned.year || ""),
    items: validItems,
  };

  if (cleaned.titleEn) res.titleEn = String(cleaned.titleEn);
  if (cleaned.company) res.company = String(cleaned.company);
  if (cleaned.coverImage) res.coverImage = String(cleaned.coverImage);
  if (cleaned.description) res.description = String(cleaned.description);
  if (cleaned.descriptionEn) res.descriptionEn = String(cleaned.descriptionEn);
  // Project theme (radius / colours) — was dropped here, so saved themes never came back.
  if (cleaned.theme && typeof cleaned.theme === "object") res.theme = cleaned.theme as ProjectData["theme"];
  // The page's frame (size, alignment) — kept like the theme.
  if (cleaned.frame && typeof cleaned.frame === "object") res.frame = cleaned.frame as ProjectData["frame"];
  // The Figma editor's file (see FigmaDocument).
  if (cleaned.canvas && typeof cleaned.canvas === "object" && Array.isArray((cleaned.canvas as { nodes?: unknown }).nodes)) res.canvas = cleaned.canvas as ProjectData["canvas"];

  return res;
}

// ── CV Functions ─────────────────────────────────────────────────────────────

export async function getCVData(): Promise<CVData> {
  const ref = doc(db, CV_COLLECTION, CV_DOC_ID);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return DEFAULT_CV_DATA;
  }

  const data = snap.data();
  delete data.updatedAt;

  return {
    myname: String(data.myname ?? ""),
    myrole: String(data.myrole ?? ""),
    profileImage: data.profileImage ?? "",
    cvPdfUrl: data.cvPdfUrl ?? "",
    cvPreviewImage: data.cvPreviewImage ?? "",
    aboutParagraphs: Array.isArray(data.aboutParagraphs) ? data.aboutParagraphs : [],
    experience: (Array.isArray(data.experience) ? data.experience : []).map((exp: any) => ({
      id: exp.id || Math.random().toString(36).slice(2, 9),
      year: exp.year || "",
      company: exp.company || "",
      role: exp.role || exp.title || "",
      description: exp.description || "",
    })),
    education: (Array.isArray(data.education) ? data.education : []).map((edu: any) => ({
      id: edu.id || Math.random().toString(36).slice(2, 9),
      year: edu.year || "",
      institution: edu.institution || "",
      degree: edu.degree || edu.title || "",
      description: edu.description || "",
    })),
    skillsList: (Array.isArray(data.skillsList) ? data.skillsList : []).map((sk: any) => ({
      id: sk.id || Math.random().toString(36).slice(2, 9),
      name: sk.name || "",
      level: typeof sk.level === "number" ? sk.level : 50,
      iconType: sk.iconType || "figma",
    })),
    hobbies: Array.isArray(data.hobbies) ? data.hobbies : [],
    contact: (Array.isArray(data.contact) ? data.contact : []).map((c: any) => ({
      id: c.id || Math.random().toString(36).slice(2, 9),
      label: c.label || "",
      value: c.value || "",
      href: c.href || "",
    })),
  };
}

export async function saveCVData(data: CVData): Promise<void> {
  const ref = doc(db, CV_COLLECTION, CV_DOC_ID);
  const cleanData = stripUndefined({
    ...data,
    myname: data.myname || "",
    myrole: data.myrole || "",
    updatedAt: serverTimestamp(),
  });
  await setDoc(ref, cleanData);
}

// ── Save (create or overwrite) ────────────────────────────────────────────────

export async function saveProject(data: ProjectData): Promise<void> {
  if (!data.slug) throw new Error("Project slug is required");

  const cleanData = stripUndefined({
    ...data,
    updatedAt: serverTimestamp(),
  });

  const ref = doc(db, COLLECTION, data.slug);
  await setDoc(ref, cleanData);
}

// ── Load ──────────────────────────────────────────────────────────────────────

export async function loadProject(slug: string): Promise<ProjectData | null> {
  const ref  = doc(db, COLLECTION, slug);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return normalizeProjectData(snap.data() as Record<string, unknown>);
}

// ── List all projects ─────────────────────────────────────────────────────────

export async function listProjects(): Promise<ProjectData[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => normalizeProjectData(d.data() as Record<string, unknown>));
}

// ── The site's design system (see SiteDesign) ────────────────────────────────

const DESIGN_COLLECTION = "design";

// ── Design variables (site-wide, see DesignVariable) ──────────────────────────

const VARIABLES_DOC_ID = "variables";

/** The variables stored for the site (the starting ones are added by withStartingVariables) — none when they can't be read. */
export async function loadDesignVariables(): Promise<DesignVariable[]> {
  try {
    const snap = await getDoc(doc(db, DESIGN_COLLECTION, VARIABLES_DOC_ID));
    const list = snap.exists() ? snap.data().variables : undefined;
    return Array.isArray(list) ? (list as DesignVariable[]) : [];
  } catch (err) {
    console.warn("Design variables could not be loaded — using the site's tokens:", err);
    return [];
  }
}

export async function saveDesignVariables(variables: DesignVariable[]): Promise<void> {
  await setDoc(doc(db, DESIGN_COLLECTION, VARIABLES_DOC_ID), { variables: stripUndefined({ list: variables }).list, updatedAt: serverTimestamp() });
}

// ── Text styles (site-wide, see TextStyle) ────────────────────────────────────

/** Stored as the atoms were, in the same shape — both branches read and write it. */
const TEXT_STYLES_DOC_ID = "atoms";

/** The text styles stored for the site (the starting ones are added by withStartingTextStyles) — none when they can't be read. */
export async function loadTextStyles(): Promise<TextStyle[]> {
  try {
    const snap = await getDoc(doc(db, DESIGN_COLLECTION, TEXT_STYLES_DOC_ID));
    const list = snap.exists() ? snap.data().atoms : undefined;
    return Array.isArray(list) ? (list as TextStyle[]) : [];
  } catch (err) {
    console.warn("Text styles could not be loaded — using the starting ones:", err);
    return [];
  }
}

export async function saveTextStyles(styles: TextStyle[]): Promise<void> {
  // Each as an atom of text, as the atomic-design branch reads them.
  const atoms = styles.map((style) => ({ ...style, kind: "text" }));
  await setDoc(doc(db, DESIGN_COLLECTION, TEXT_STYLES_DOC_ID), { atoms: stripUndefined({ list: atoms }).list, updatedAt: serverTimestamp() });
}

// ── Components (site-wide, see DesignComponent) ───────────────────────────────

/**
 * Stored apart from the molecules and main components of before (the
 * atomic-design branch's `molecules` / `components`), which are only read:
 * the first time, as what the components start from.
 */
const COMPONENTS_DOC_ID = "figmaComponents";

async function readList<T>(docId: string, field: string): Promise<T[]> {
  const snap = await getDoc(doc(db, DESIGN_COLLECTION, docId));
  const list = snap.exists() ? snap.data()[field] : undefined;
  return Array.isArray(list) ? (list as T[]) : [];
}

/**
 * The components stored for the site (the starting ones are added by
 * withStartingComponents). Before any was stored: the ones the legacy
 * designs amount to (componentsFromLegacy) — `fromLegacy`, so that saving
 * stores them. None when they can't be read.
 */
export async function loadDesignComponents(): Promise<{ components: DesignComponent[]; fromLegacy: boolean }> {
  try {
    const snap = await getDoc(doc(db, DESIGN_COLLECTION, COMPONENTS_DOC_ID));
    if (snap.exists()) {
      const list = snap.data().components;
      return { components: Array.isArray(list) ? (list as DesignComponent[]) : [], fromLegacy: false };
    }
    const [designs, molecules] = await Promise.all([
      getDoc(doc(db, DESIGN_COLLECTION, "components")).then((d) => (d.exists() ? (d.data() as LegacyDesigns) : {})),
      readList<LegacyMolecule>("molecules", "molecules"),
    ]);
    delete (designs as Record<string, unknown>).updatedAt;
    const components = componentsFromLegacy(designs, molecules);
    return { components, fromLegacy: components.length > 0 };
  } catch (err) {
    console.warn("Components could not be loaded — using the starting ones:", err);
    return { components: [], fromLegacy: false };
  }
}

export async function saveDesignComponents(components: DesignComponent[]): Promise<void> {
  await setDoc(doc(db, DESIGN_COLLECTION, COMPONENTS_DOC_ID), { components: stripUndefined({ list: components }).list, updatedAt: serverTimestamp() });
}

// ── The Bileşenler page's own drawings (see CanvasNode) ───────────────────────

const CANVAS_DOC_ID = "figmaCanvas";

/** The frames, shapes and texts drawn on the Bileşenler page — none when they can't be read. */
export async function loadCanvasNodes(): Promise<CanvasNode[]> {
  try {
    return await readList<CanvasNode>(CANVAS_DOC_ID, "nodes");
  } catch (err) {
    console.warn("The components page's drawings could not be loaded:", err);
    return [];
  }
}

export async function saveCanvasNodes(nodes: CanvasNode[]): Promise<void> {
  await setDoc(doc(db, DESIGN_COLLECTION, CANVAS_DOC_ID), { nodes: stripUndefined({ list: nodes }).list, updatedAt: serverTimestamp() });
}

// ── Delete project ────────────────────────────────────────────────────────────

export async function deleteProject(slug: string): Promise<void> {
  if (!slug) throw new Error("Project slug is required");
  const ref = doc(db, COLLECTION, slug);
  await deleteDoc(ref);
}
