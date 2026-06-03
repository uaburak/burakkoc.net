import { ThemeToggle } from "@/components/ThemeToggle";
import SlimeController from "@/components/SlimeController";

export const metadata = {
  title: "Burak Koç",
  description: "UX/UI Designer crafting digital products with clarity and craft.",
};

export default function Home() {
  return (
    <div className="h-screen bg-[var(--bg-1)] transition-colors duration-200 relative overflow-hidden">

      {/* ── 720px Ana Kapsayıcı (ekranda ortalı) ── */}
      <div
        className="relative z-30 flex flex-col"
        style={{ maxWidth: 720, margin: '0 auto', padding: '0 20px', height: 'calc(100vh - 240px)' }}
      >

        {/* ── Theme Toggle (kapsayıcının sağ üstü) ── */}
        <div className="flex justify-end" style={{ paddingTop: 32 }}>
          <ThemeToggle />
        </div>

        {/* ── Hero (dikeyde ortalı, sola yaslı) ── */}
        <div className="flex-1 flex items-center">
          <div style={{ width: '100%' }}>
            <h1 className="text-base font-medium text-[var(--text-title)] leading-5">Burak Koç</h1>
            <p className="text-base font-light text-[var(--text-subtitle)] mt-0.5">
              UX/UI Designer.
            </p>

            <p className="text-base font-light leading-7 text-[var(--text-p)] mt-6">
              I design digital products with a focus on clarity and craft.
              Based in Antalya — currently at Anex Tour, open to freelance projects.
            </p>
          </div>
        </div>

      </div>

      <SlimeController />
    </div>
  );
}
