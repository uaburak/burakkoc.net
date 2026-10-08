import { listPublished } from "@/lib/firestore";
import ProjectsClient from "./ProjectsClient";

export const metadata = {
  title: "Projeler",
  description: "Burak Koç'un projeleri ve çalışmaları.",
  alternates: { canonical: "/projects" },
};

// Built statically and made again at most once a minute.
export const revalidate = 60;

export default async function ProjectsPage() {
  const projects = await listPublished();
  return <ProjectsClient initialProjects={projects} />;
}
