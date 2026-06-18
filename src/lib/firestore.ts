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

const COLLECTION = "projects";

// ── Save (create or overwrite) ────────────────────────────────────────────────

export async function saveProject(data: ProjectData): Promise<void> {
  if (!data.slug) throw new Error("Project slug is required");

  const ref = doc(db, COLLECTION, data.slug);
  await setDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// ── Load ──────────────────────────────────────────────────────────────────────

export async function loadProject(slug: string): Promise<ProjectData | null> {
  const ref  = doc(db, COLLECTION, slug);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const data = snap.data();

  // Convert Firestore Timestamps to plain values if present
  const cleaned = { ...data };
  if (cleaned.updatedAt instanceof Timestamp) delete cleaned.updatedAt;
  if (cleaned.createdAt instanceof Timestamp) delete cleaned.createdAt;

  return cleaned as ProjectData;
}

// ── List all projects ─────────────────────────────────────────────────────────

export async function listProjects(): Promise<ProjectData[]> {
  const snap = await getDocs(collection(db, COLLECTION));
  return snap.docs.map((d) => {
    const data = { ...d.data() } as Record<string, unknown>;
    // Strip server timestamps
    delete data.updatedAt;
    delete data.createdAt;
    return data as unknown as ProjectData;
  });
}

// ── Delete project ────────────────────────────────────────────────────────────

export async function deleteProject(slug: string): Promise<void> {
  if (!slug) throw new Error("Project slug is required");
  const ref = doc(db, COLLECTION, slug);
  await deleteDoc(ref);
}
