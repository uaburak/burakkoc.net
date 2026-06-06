import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ChevronLeftSmall } from "@/components/icons";

interface PageHeaderProps {
  /** Geri linkin href'i. Verilmezse sadece başlık gösterilir. */
  backHref?: string;
  /** Geri linkin metni veya sol tarafta gösterilecek başlık. */
  backLabel: string;
}

/**
 * Basit sayfa üstü navigasyon çubuğu.
 * Sol: geri linki (opsiyonel), Sağ: ThemeToggle.
 * Kullanım: admin, projects, vb. düz sayfalar için.
 */
export function PageHeader({ backHref, backLabel }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 pt-8">
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
      <ThemeToggle />
    </div>
  );
}
