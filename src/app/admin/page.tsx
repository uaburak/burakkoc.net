import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { ArrowLeftIcon, ChevronRight } from "@/components/icons";

export const metadata = {
  title: "Admin | Portfolio",
};

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-1)] transition-colors duration-200 relative">
      {/* ── Left Sidebar (Desktop XL): Anasayfa ── */}
      <div
        className="fixed top-[160px] w-[200px] flex-col items-start gap-1 z-20 hidden xl:flex"
        style={{ left: "calc(50% - 468px - var(--scrollbar-width, 0px) / 2)" }}
      >
        <Link
          href="/"
          className="inline-flex items-center gap-1 px-[10px] py-[10px] rounded-full font-medium text-base leading-5 text-[var(--text-p)] transition-all duration-200 hover:bg-[var(--bg-4)] active:scale-95"
        >
          <span className="flex items-center justify-center w-5 h-5">
            <ArrowLeftIcon />
          </span>
          <span className="px-1">Anasayfa</span>
        </Link>
      </div>

      {/* ── Main content (720px centered layout, no title) ── */}
      <main className="flex flex-col items-start w-full max-w-[720px] mx-auto px-5 pt-10 pb-[60px] xl:px-6 xl:pt-[160px] xl:pb-[60px]">
        <nav className="flex flex-col gap-0 w-full">
          <Link
            href="/admin/projects"
            className="group flex items-center justify-between py-[10px] border-b border-[var(--border)] transition-all duration-150 hover:bg-[var(--bg-3)]"
          >
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-base font-medium leading-5 text-[var(--text-title)]">
                Projeler
              </span>
              <span className="text-base font-normal leading-6 text-[var(--text-subtitle)]">
                Projeleri yönet, yeni proje oluştur
              </span>
            </div>
            <ChevronRight />
          </Link>

          <Link
            href="/admin/cv"
            className="group flex items-center justify-between py-[10px] border-b border-[var(--border)] transition-all duration-150 hover:bg-[var(--bg-3)]"
          >
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-base font-medium leading-5 text-[var(--text-title)]">
                CV / Özgeçmiş
              </span>
              <span className="text-base font-normal leading-6 text-[var(--text-subtitle)]">
                Profil, deneyimler, eğitim ve yetenekleri yönet
              </span>
            </div>
            <ChevronRight />
          </Link>
        </nav>
      </main>
    </div>
  );
}
