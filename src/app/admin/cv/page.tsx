import { CVAdminClient } from "./CVAdminClient";
import { EditorProvider } from "@/components/admin/EditorNavControls";

export const metadata = {
  title: "Admin — CV / Özgeçmiş | Portfolio",
};

export default function CVAdminPage() {
  return (
    <EditorProvider>
      <CVAdminClient />
    </EditorProvider>
  );
}
