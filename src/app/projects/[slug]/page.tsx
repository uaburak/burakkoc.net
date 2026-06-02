import { ProjectDetailClient } from "./ProjectDetailClient";
import { loadProject } from "@/lib/firestore";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  try {
    const project = await loadProject(slug);
    if (project) {
      return {
        title: `${project.title} | Burak Koç`,
        description: `${project.category} · ${project.year}`,
      };
    }
  } catch (err) {
    console.error("Failed to generate metadata for project page:", err);
  }
  return {
    title: `${slug.charAt(0).toUpperCase() + slug.slice(1)} | Burak Koç`,
  };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;
  return <ProjectDetailClient slug={slug} />;
}

