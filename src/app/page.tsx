import { ThemeToggle } from "@/components/ThemeToggle";
import TextScrollingEffect from "@/components/TextScrollingEffect";
import SlimeController from "@/components/SlimeController";

export const metadata = {
  title: "Burak Koç",
  description: "UX/UI Designer crafting digital products with clarity and craft.",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--bg-1)] transition-colors duration-200 relative pb-[160px]">

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

      </main>

      {/* 2D Slime İnteraktif Mikro Etkileşimi - Ekranın En Altında (Tam Genişlik) */}
      <SlimeController />
    </div>
  );
}
