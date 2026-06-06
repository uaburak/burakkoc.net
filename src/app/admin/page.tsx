import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ChevronRight } from "@/components/icons";

export const metadata = {
  title: "Admin | Portfolio",
};

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-1)] transition-colors duration-200">
      <PageHeader backLabel="Admin" />

      <main className="max-w-[720px] mx-auto px-6 pt-16 pb-24">
        <h1 className="text-base font-medium text-[var(--text-title)] mb-8">Yönetici Paneli</h1>

        <nav className="flex flex-col gap-0">
          <Link
            href="/admin/projects"
            className="group flex items-center justify-between py-4 border-b border-[var(--border)] transition-all duration-200 hover:opacity-60"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-medium text-[var(--text-title)]">Projeler</span>
              <span className="text-sm font-light text-[var(--text-subtitle)]">Projeleri yönet, yeni proje oluştur</span>
            </div>
            <ChevronRight />
          </Link>
        </nav>
      </main>
    </div>
  );
}
