"use client";

import Link from "next/link";
import { useEffect } from "react";

/** A page that failed to draw (a broken document, a part that threw): said, with a way to try again — the rest of the site stays. */
export default function Error({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="min-h-screen bg-[var(--bg-1)] flex items-center justify-center px-6">
      <div className="text-center flex flex-col items-center gap-4">
        <h1 className="text-base font-medium text-[var(--text-title)]">Bu sayfa şu an gösterilemiyor</h1>
        <p className="text-sm font-light text-[var(--text-subtitle)]">Bir şeyler ters gitti. Birazdan tekrar dene.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => unstable_retry()} className="px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--bg-2)] text-sm text-[var(--text-p)] hover:bg-[var(--bg-4)] transition-all duration-200 cursor-pointer">
            Tekrar dene
          </button>
          <Link href="/" className="px-4 py-2 rounded-full border border-[var(--border)] text-sm text-[var(--text-p)] hover:bg-[var(--bg-4)] transition-all duration-200">
            Anasayfa
          </Link>
        </div>
      </div>
    </div>
  );
}
