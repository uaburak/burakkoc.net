import type { MetadataRoute } from "next";
import { listPublished } from "@/lib/firestore";
import { SITE_URL } from "@/lib/siteConfig";

// Made again at most once an hour (a project published since shows up then).
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const projects = await listPublished().catch(() => []);
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/projects`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/cv`, changeFrequency: "monthly", priority: 0.6 },
    ...projects.map((p) => ({ url: `${SITE_URL}/projects/${p.slug}`, lastModified: p.publishedAt ? new Date(p.publishedAt) : undefined, changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}
