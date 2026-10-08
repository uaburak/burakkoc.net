import { CVClient } from "./CVClient";
import { getCVData, listPublished } from "@/lib/firestore";

export const metadata = {
  title: "CV",
  description: "Product designer & developer. Resume and professional background of Burak Koç.",
  alternates: { canonical: "/cv" },
};

// Made again at most once a minute: a CV saved in the admin shows within it.
export const revalidate = 60;

export default async function CVPage() {
  const [cvData, projects] = await Promise.all([getCVData(), listPublished().catch(() => [])]);
  return <CVClient initialCvData={cvData} projects={projects} />;
}
