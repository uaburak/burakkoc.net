import { listProjects } from "@/lib/firestore";
import ProjectsClient from "./ProjectsClient";

export const metadata = {
  title: "Projeler — Burak Koç",
  description: "Burak Koç'un projeleri ve çalışmaları.",
};

// Enable Incremental Static Regeneration (ISR) - Revalidated at most once every 60 seconds.
export const revalidate = 60;

export default async function ProjectsPage() {
  const projects = await listProjects();
  return <ProjectsClient initialProjects={projects} />;
}
