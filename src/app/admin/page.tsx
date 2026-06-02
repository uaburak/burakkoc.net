import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata = {
  title: "Admin | Portfolio",
};

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-1)] transition-colors duration-200">
      <div className="flex items-center justify-between px-6 pt-8">
        <span className="text-sm font-medium text-[var(--text-title)]">Admin</span>
        <ThemeToggle />
      </div>

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
            <svg className="w-4 h-4 text-[var(--text-subtitle)]" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </nav>
      </main>
    </div>
  );
}
