import { ProjectDetailClient } from "./ProjectDetailClient";
import { loadDesignComponents, loadDesignVariables, loadProject, listProjects, loadTextStyles } from "@/lib/firestore";

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
        title: `${project.title || slug} | Burak Koç`,
        description: [project.category, project.year].filter(Boolean).join(" · ") || undefined,
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
  // Paralel çek — Firestore istekleri birbirini beklemesin.
  const [project, projects, { components }, variables, textStyles] = await Promise.all([
    loadProject(slug),
    listProjects(),
    loadDesignComponents(),
    loadDesignVariables(),
    loadTextStyles(),
  ]);

  return (
    <ProjectDetailClient
      slug={slug}
      initialProject={project}
      initialProjects={projects}
      design={{ variables, textStyles, components }}
    />
  );
}
