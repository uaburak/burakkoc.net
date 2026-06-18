import HomeClient from "@/components/HomeClient";
import { listProjects } from "@/lib/firestore";

export const metadata = {
  title: "Burak Koç",
  description: "UX/UI Designer crafting digital products with clarity and craft.",
};

// Enable Incremental Static Regeneration (ISR) - Page will be built statically
// and revalidated in the background at most once every 60 seconds.
export const revalidate = 60;

export default async function Home() {
  const projects = await listProjects();
  return <HomeClient initialProjects={projects} />;
}
