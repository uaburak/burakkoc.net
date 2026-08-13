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

  const validItems = items.map((item: any) => {
    if (item.kind === "section") {
      return {
        ...item,
        blocks: Array.isArray(item.blocks) ? item.blocks : [],
      };
    }
    if (item.kind === "divider") {
      return item;
    }
    return {
      id: item.id || Math.random().toString(36).slice(2, 10),
      kind: "section" as const,
      title: item.title || "",
      blocks: Array.isArray(item.blocks) ? item.blocks : [],
    };
  });

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
    myname: String(data.myname || data.name || ""),
    myrole: String(data.myrole || data.role || ""),
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

// ── Delete project ────────────────────────────────────────────────────────────

export async function deleteProject(slug: string): Promise<void> {
  if (!slug) throw new Error("Project slug is required");
  const ref = doc(db, COLLECTION, slug);
  await deleteDoc(ref);
}
