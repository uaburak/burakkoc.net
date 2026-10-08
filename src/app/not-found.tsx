import Link from "next/link";

export const metadata = { title: "Sayfa bulunamadı" };

/** A page that isn't there (an unknown or unpublished project): a real 404, and the way back. */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--bg-1)] flex items-center justify-center px-6">
      <div className="text-center flex flex-col items-center gap-4">
        <h1 className="text-base font-medium text-[var(--text-title)]">Sayfa bulunamadı</h1>
        <p className="text-sm font-light text-[var(--text-subtitle)]">Aradığın sayfa yok ya da kaldırılmış.</p>
        <Link href="/projects" className="px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--bg-2)] text-sm text-[var(--text-p)] hover:bg-[var(--bg-4)] transition-all duration-200">
          Projelere dön
        </Link>
      </div>
    </div>
  );
}
