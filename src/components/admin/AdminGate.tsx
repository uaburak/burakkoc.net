"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Spinner } from "@/components/icons";
import { useAuth } from "@/lib/auth";

/** The admin's sign-in page — the one admin page that opens without a sign-in. */
export const LOGIN_PATH = "/admin/login";

/**
 * The admin's door: its pages only for the admin's Google account (see
 * ADMIN_EMAILS). Anyone else — nobody signed in, or another account — is
 * sent to the sign-in page, which sends them back here once they are in.
 * This decides what is shown — what keeps the data safe is the project's
 * security rules, which refuse every write (and every read of a draft) to
 * anyone else.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const signInPage = pathname === LOGIN_PATH;
  const allowed = auth.status === "bypass" || (auth.status === "signed-in" && auth.admin);
  const refused = !signInPage && (auth.status === "signed-out" || (auth.status === "signed-in" && !auth.admin));

  useEffect(() => {
    if (!refused) return;
    // Back to this page (its query too) once signed in.
    router.replace(`${LOGIN_PATH}?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [refused, router]);

  if (signInPage || allowed) return <>{children}</>;
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-1)]">
      <Spinner className="w-6 h-6 text-[var(--text-subtitle)]" />
    </div>
  );
}
