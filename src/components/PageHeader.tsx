import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ChevronLeftSmall } from "@/components/icons";

interface PageHeaderProps {
  /** Geri linkin href'i. Verilmezse sadece başlık gösterilir. */
  backHref?: string;
  /** Geri linkin metni veya sol tarafta gösterilecek başlık. */
  backLabel: string;
  /** Dark mode butonunun gösterilip gösterilmeyeceği (varsayılan: true). */
  showThemeToggle?: boolean;
}

/**
 * Basit sayfa üstü navigasyon çubuğu.
 * Sol: geri linki (opsiyonel), Sağ: ThemeToggle.
 * Kullanım: admin, projects, vb. düz sayfalar için.
 */
export function PageHeader({ backHref, backLabel, showThemeToggle = true }: PageHeaderProps) {
  return (
    /* İçerik sütunuyla aynı kapsayıcı (max-w-720 + px-6) → butonlar content ile aynı hizada */
    <div className="w-full max-w-[720px] mx-auto px-6">
      <div className="flex items-center justify-between pt-8">
        {backHref ? (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--text-subtitle)] hover:text-[var(--text-p)] transition-colors duration-200"
          >
            <ChevronLeftSmall />
            {backLabel}
          </Link>
        ) : (
          <span className="text-sm font-medium text-[var(--text-title)]">{backLabel}</span>
        )}
        {showThemeToggle && <ThemeToggle />}
      </div>
    </div>
  );
}
