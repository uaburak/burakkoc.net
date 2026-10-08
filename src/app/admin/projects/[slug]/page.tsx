import { AdminEditorClient } from "./AdminEditorClient";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return {
    title: `${slug} — Editor`,
  };
}

export default async function AdminProjectPage({ params }: Props) {
  const { slug } = await params;
  return (
    <div data-no-page-scroll="" className="h-screen overflow-hidden flex flex-col bg-[var(--bg-1)] transition-colors duration-200">
      <AdminEditorClient slug={slug} />
    </div>
  );
}
