import { CVClient } from "./CVClient";
import { getCVData } from "@/lib/firestore";

export const metadata = {
  title: "CV — Burak Koç",
  description: "Product designer & developer. Resume and professional background of Burak Koç.",
};

// Force dynamic rendering on server so updates saved in Admin panel show immediately
export const dynamic = "force-dynamic";

export default async function CVPage() {
  const cvData = await getCVData();
  return <CVClient initialCvData={cvData} />;
}
