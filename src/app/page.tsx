import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata = {
  title: "Burak Koç",
  description: "Product designer & developer.",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--bg-1)] transition-colors duration-200">
      <div className="flex items-center justify-between px-6 pt-8">
        <span className="text-sm font-medium text-[var(--text-title)]">Burak Koç</span>
        <ThemeToggle />
      </div>

      <main className="flex flex-col justify-center min-h-[80vh] px-6 max-w-[720px] mx-auto">
        <h1 className="text-base font-medium text-[var(--text-title)] mb-1">Burak Koç</h1>
        <p className="text-base font-light text-[var(--text-subtitle)] mb-8">
          Product designer &amp; developer.
        </p>

        <nav className="flex flex-col gap-0">
          <Link
            href="/projects"
            className="group flex items-center justify-between py-4 border-b border-[var(--border)] transition-all duration-200 hover:opacity-60"
          >
            <span className="text-base font-medium text-[var(--text-title)]">Projeler</span>
            <svg className="w-4 h-4 text-[var(--text-subtitle)]" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </nav>
      </main>
    </div>
  );
}
