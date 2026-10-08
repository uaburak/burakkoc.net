import { DraftPreview } from "./DraftPreview";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  return { title: `${slug} — Draft preview` };
}

export default async function DraftPreviewPage({ params }: Props) {
  const { slug } = await params;
  return <DraftPreview slug={slug} />;
}
