"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowLeftIcon } from "@/components/icons";

interface TopBarProps {
  /** Geri linkin href'i. */
  backHref: string;
  /** Geri linkin metni. */
  backLabel: string;
  /** Ek sınıflar (ör. xl:hidden). */
  className?: string;
  /** Dark mode butonunun gösterilip gösterilmeyeceği (varsayılan: true). */
  showThemeToggle?: boolean;
}

/**
 * Sayfa üstü navigasyon çubuğu — geri linki + ThemeToggle.
 *
 * İçerik sütunuyla aynı kapsayıcıyı (max-w-720 + aynı yatay padding) kullanır,
 * böylece buton kenarları main içeriğiyle birebir aynı hizada durur.
 * Butonun kendi iç padding'i negatif margin ile geri alınır (optik hizalama).
 */
export function TopBar({
  backHref,
  backLabel,
  className = "",
  showThemeToggle = true,
}: TopBarProps) {
  return (
    <div className={`absolute top-0 left-0 right-0 z-20 pointer-events-none ${className}`}>
      <div className="w-full max-w-[720px] mx-auto px-5 xl:px-6">
        <div className="flex items-center justify-between pt-8">
          <Link
            href={backHref}
            className="-ml-3 inline-flex items-center gap-1 px-3 py-2 rounded-full font-medium text-sm text-[var(--text-p)] transition-all duration-200 hover:bg-[var(--bg-4)] active:scale-95 pointer-events-auto"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            <span>{backLabel}</span>
          </Link>
          {showThemeToggle && (
            <div className="pointer-events-auto">
              <ThemeToggle />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
