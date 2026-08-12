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
  name: "Burak KOÇ",
  role: "UX/UI Designer",
  profileImage: "/pp-new-2.jpg",
  aboutParagraphs: [
    "Hello, I was born in Tokat in 1996. Listening to music and playing instruments are great passions of mine. I enjoy exploring different genres and developing my skills with various instruments.",
    "I generally adopt a solution-oriented approach to life, which guides me in both my personal and professional life. Working in an office has always been my priority. When it comes to technology, I prefer using MacOS.",
  ],
  experience: [
    {
      id: "exp-1",
      year: "Jul 2024 — Present",
      company: "Anex Tour",
      role: "UX/UI Designer",
      description:
        "Designing user interfaces and experiences for one of Turkey's leading tour operators. Responsible for end-to-end UX design of digital touchpoints across web and mobile platforms.",
    },
    {
      id: "exp-2",
      year: "Dec 2022 — Apr 2024",
      company: "DGTLFACE | Technology Partner",
      role: "UX/UI Designer",
      description:
        "Designed digital products and interfaces for a technology partner studio. Worked across multiple client projects delivering high-fidelity UI designs, prototypes, and design systems.",
    },
    {
      id: "exp-3",
      year: "Jun 2022 — Nov 2022",
      company: "Ideapol Digital Media Agency",
      role: "Graphic Designer",
      description:
        "Created visual assets and design materials for digital media campaigns. Collaborated closely with creative and marketing teams to produce compelling brand communications.",
    },
    {
      id: "exp-4",
      year: "Aug 2016 — Nov 2021",
      company: "Turpaksan Ltd. Şti. Hobby House",
      role: "Graphic Designer",
      description:
        "Developed brand identities, print materials, and digital visuals. Managed multiple design projects simultaneously while maintaining consistent brand standards.",
    },
    {
      id: "exp-5",
      year: "Feb 2012 — ∞",
      company: "Freelance",
      role: "Graphic Designer",
      description:
        "Independent graphic design work for a diverse range of clients. Services include branding, visual identity, print design, and digital illustration.",
    },
  ],
  education: [
    {
      id: "edu-1",
      year: "2017 — 2019",
      institution: "Tokat Gazi Osman Paşa Üniversitesi",
      degree: "Turhal MYO — Grafik Tasarım Bölümü",
      description:
        "Associate degree in Graphic Design. Gained a strong foundation in visual communication, typography, and digital design tools.",
    },
    {
      id: "edu-2",
      year: "2010 — 2014",
      institution: "Tokat Otelcilik ve Turizm Meslek Lisesi",
      degree: "Yiyecek İçecek Hizmetleri Mutfak Bölümü",
      description:
        "Vocational high school with a focus on hospitality and food & beverage services.",
    },
  ],
  skillsList: [
    { id: "sk-1", name: "Figma", level: 95, iconType: "figma" },
    { id: "sk-2", name: "Illustrator", level: 95, iconType: "illustrator" },
    { id: "sk-3", name: "Photoshop", level: 90, iconType: "photoshop" },
    { id: "sk-4", name: "AI Models", level: 80, iconType: "ai" },
    { id: "sk-5", name: "Indesign", level: 45, iconType: "indesign" },
    { id: "sk-6", name: "Office", level: 60, iconType: "office" },
    { id: "sk-7", name: "After Effect", level: 55, iconType: "aftereffect" },
    { id: "sk-8", name: "HTML", level: 65, iconType: "html" },
    { id: "sk-9", name: "CSS", level: 80, iconType: "css" },
    { id: "sk-10", name: "Tailwind CSS", level: 35, iconType: "tailwind" },
  ],
  hobbies: [
    "Making / Listening to Music",
    "Computer Games",
    "Camping",
  ],
  contact: [
    { id: "cnt-1", label: "Email", value: "info@burakkoc.net", href: "mailto:info@burakkoc.net" },
    { id: "cnt-2", label: "Website", value: "www.burakkoc.net", href: "https://www.burakkoc.net" },
    { id: "cnt-3", label: "Instagram", value: "/uaburak", href: "https://instagram.com/uaburak" },
    { id: "cnt-4", label: "Behance", value: "/uaburak", href: "https://behance.net/uaburak" },
    { id: "cnt-5", label: "LinkedIn", value: "/uaburak", href: "https://linkedin.com/in/uaburak" },
    { id: "cnt-6", label: "Dribbble", value: "/burakkoc", href: "https://dribbble.com/burakkoc" },
  ],
  cvPdfUrl: "/CV-EN.pdf",
};

// ── CV Functions ─────────────────────────────────────────────────────────────

export async function getCVData(): Promise<CVData> {
  const ref = doc(db, CV_COLLECTION, CV_DOC_ID);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // Seed initial default CV data into Firestore if doc does not exist
    await setDoc(ref, {
      ...DEFAULT_CV_DATA,
      updatedAt: serverTimestamp(),
    });
    return DEFAULT_CV_DATA;
  }

  const data = snap.data();
  delete data.updatedAt;
  return data as CVData;
}

export async function saveCVData(data: CVData): Promise<void> {
  const ref = doc(db, CV_COLLECTION, CV_DOC_ID);
  await setDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

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
