import HomeClient from "@/components/HomeClient";
import { listPublished } from "@/lib/firestore";

export const metadata = {
  title: { absolute: "Burak Koç" },
  description: "UX/UI Designer crafting digital products with clarity and craft.",
  alternates: { canonical: "/" },
};

// Built statically and made again at most once a minute.
export const revalidate = 60;

export default async function Home() {
  const projects = await listPublished();
  return <HomeClient initialProjects={projects} />;
}
