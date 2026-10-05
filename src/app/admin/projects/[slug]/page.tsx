import { AdminEditorClient } from "./AdminEditorClient";
import { EditorProvider } from "@/components/admin/EditorNavControls";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return {
    title: `Admin — ${slug} | Portfolio`,
  };
}

export default async function AdminProjectPage({ params }: Props) {
  const { slug } = await params;

  return (
    <EditorProvider>
      <div data-no-page-scroll="" className="h-screen overflow-hidden flex flex-col bg-[var(--bg-1)] transition-colors duration-200">
        <AdminEditorClient slug={slug} />
      </div>
    </EditorProvider>
  );
}

