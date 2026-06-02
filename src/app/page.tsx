import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import TextScrollingEffect from "@/components/TextScrollingEffect";
import ScrollReveal from "@/components/ScrollReveal";

export const metadata = {
  title: "Burak Koç",
  description: "UX/UI Designer crafting digital products with clarity and craft.",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--bg-1)] transition-colors duration-200 relative">

      {/* ── Left sidebar (xl+) ── */}
      <div className="fixed top-[160px] left-[calc(50%-468px)] w-[200px] flex-col items-start gap-3 z-20 hidden xl:flex">
        <ThemeToggle />
      </div>

      {/* ── Mobile top bar ── */}
      <div className="flex xl:hidden items-center justify-end px-5 pt-8 pb-0">
        <ThemeToggle />
      </div>

      <main className="flex flex-col items-start w-full max-w-[720px] mx-auto px-5 py-10 xl:px-6 xl:py-[160px]">

        {/* ─── Hero ─── */}
        <div className="w-full pt-[10px] pb-8">
          <TextScrollingEffect>
            <h1 className="text-base font-medium text-[var(--text-title)] leading-5">Burak Koç</h1>
            <p className="text-base font-light text-[var(--text-subtitle)] mt-0.5">
              UX/UI Designer.
            </p>
          </TextScrollingEffect>

          <TextScrollingEffect className="mt-6">
            <p className="text-base font-light leading-7 text-[var(--text-p)] max-w-[440px]">
              I design digital products with a focus on clarity and craft.
              Based in Antalya — currently at Anex Tour, open to freelance projects.
            </p>
          </TextScrollingEffect>
        </div>

        {/* ─── Bento Navigation Grid ─── */}
        <ScrollReveal className="w-full">
          <div className="grid grid-cols-2 gap-3 w-full">

            {/* About me — left top */}
            <Link
              id="nav-about"
              href="/cv"
              className="group rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] min-h-[220px] p-5 flex flex-col transition-all duration-200 hover:bg-[var(--bg-3)]"
            >
              <span className="text-base font-medium text-[var(--text-title)]">About me</span>
            </Link>

            {/* Projects — right column, spans both rows */}
            <Link
              id="nav-projects"
              href="/projects"
              className="group rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] row-span-2 p-5 flex flex-col transition-all duration-200 hover:bg-[var(--bg-3)]"
            >
              <span className="text-base font-medium text-[var(--text-title)]">Projects</span>
            </Link>

            {/* Contact — left bottom */}
            <a
              id="nav-contact"
              href="mailto:info@burakkoc.net"
              className="group rounded-[32px] border border-[var(--border)] bg-[var(--bg-2)] min-h-[220px] p-5 flex flex-col transition-all duration-200 hover:bg-[var(--bg-3)]"
            >
              <span className="text-base font-medium text-[var(--text-title)]">Contact</span>
            </a>

          </div>
        </ScrollReveal>

      </main>
    </div>
  );
}
