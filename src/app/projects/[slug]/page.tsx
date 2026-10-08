import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listPublished, loadPublished } from "@/lib/firestore";
import { SITE_URL } from "@/lib/siteConfig";
import { ProjectDetailClient } from "./ProjectDetailClient";

interface Props {
  params: Promise<{ slug: string }>;
}

// Built ahead for every published project, made again at most once a minute; a project published since is made when first asked for.
export const revalidate = 60;

// One read of each per request (the metadata and the page share them).
const publishedPage = cache((slug: string) => loadPublished(slug));
const summaries = cache(() => listPublished());

export async function generateStaticParams() {
  try {
    return (await summaries()).map((project) => ({ slug: project.slug }));
  } catch (err) {
    console.error("Failed to list the published projects:", err);
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await publishedPage(slug);
  if (!page) notFound();
  const { summary } = page;
  const title = summary.title || slug;
  const description = summary.description?.trim() || [summary.category, summary.year].filter(Boolean).join(" · ") || undefined;
  const images = summary.coverImage ? [{ url: summary.coverImage, alt: title }] : undefined;
  return {
    title,
    description,
    alternates: { canonical: `/projects/${slug}` },
    openGraph: { type: "article", title, description, images },
    twitter: { card: images ? "summary_large_image" : "summary", title, description, images: images?.map((i) => i.url) },
  };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;
  const [page, all] = await Promise.all([publishedPage(slug), summaries()]);
  if (!page) notFound();
  // The ones before and after it, in the projects' order (round).
  const at = all.findIndex((p) => p.slug === slug);
  const around = all.length > 1 && at >= 0 ? { prev: all[(at - 1 + all.length) % all.length], next: all[(at + 1) % all.length] } : { prev: null, next: null };
  // What search engines read of it: a creative work, by its author.
  const { summary } = page;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: summary.title || slug,
    ...(summary.description ? { description: summary.description } : {}),
    ...(summary.coverImage ? { image: summary.coverImage } : {}),
    ...(summary.category ? { genre: summary.category } : {}),
    ...(summary.year ? { dateCreated: summary.year } : {}),
    url: `${SITE_URL}/projects/${slug}`,
    author: { "@type": "Person", name: "Burak Koç", url: SITE_URL },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <ProjectDetailClient page={page} prev={around.prev} next={around.next} />
    </>
  );
}
