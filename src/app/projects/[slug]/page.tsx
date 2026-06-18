import { ProjectDetailClient } from "./ProjectDetailClient";
import { loadProject, listProjects } from "@/lib/firestore";

interface Props {
  params: Promise<{ slug: string }>;
}

// Enable ISR revalidation every 60 seconds
export const revalidate = 60;

// Pre-render static pages for all projects at build time
export async function generateStaticParams() {
  try {
    const projects = await listProjects();
    return projects.map((project) => ({
      slug: project.slug,
    }));
  } catch (err) {
    console.error("Failed to generate static params:", err);
    return [];
  }
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
  const project = await loadProject(slug);
  const projects = await listProjects();

  return (
    <ProjectDetailClient
      slug={slug}
      initialProject={project}
      initialProjects={projects}
    />
  );
}
