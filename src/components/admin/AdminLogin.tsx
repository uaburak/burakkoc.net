"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, Spinner } from "@/components/icons";
import { signInWithGoogle, useAuth } from "@/lib/auth";
import { LOGIN_PATH } from "./AdminGate";

/** Where to go once signed in: the admin page that sent here (`?next=`) — only one of the admin's own, never another address. */
function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/admin") && !next.startsWith("//") && !next.startsWith(LOGIN_PATH) ? next : "/admin";
}

/** What a failed sign-in says, in words (Firebase Auth's error codes). */
function reasonOf(err: { code?: string; message?: string }) {
  switch (err.code) {
    case "auth/unauthorized-domain":
      return `Bu alan adı (${window.location.hostname}) Firebase Authentication'da yetkili değil — Authentication › Settings › Authorized domains'e ekle.`;
    case "auth/operation-not-allowed":
      return "Google ile giriş Firebase'de açık değil (Authentication › Sign-in method).";
    case "auth/popup-blocked":
      return "Tarayıcı giriş penceresini engelledi — bu site için açılır pencerelere izin verip tekrar dene.";
    case "auth/network-request-failed":
      return "Bağlantı kurulamadı — internet bağlantını kontrol edip tekrar dene.";
    default:
      return err.message ?? String(err);
  }
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * The admin's sign-in page (/admin/login): every admin page sends here
 * while nobody — or another account — is signed in, and is gone back to
 * once the admin's Google account is.
 */
export function AdminLogin() {
  const auth = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const allowed = auth.status === "bypass" || (auth.status === "signed-in" && auth.admin);

  useEffect(() => {
    if (allowed) router.replace(nextPath());
  }, [allowed, router]);

  // Google's account chooser opens each time (select_account): signing in with another account takes the place of this one.
  const signIn = () => {
    setError("");
    setBusy(true);
    signInWithGoogle()
      .catch((err: { code?: string; message?: string }) => {
        if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") return;
        setError(reasonOf(err));
      })
      .finally(() => setBusy(false));
  };

  if (auth.status === "loading" || allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-1)]">
        <Spinner className="w-6 h-6 text-[var(--text-subtitle)]" />
      </div>
    );
  }

  const refused = auth.status === "signed-in";
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg-1)] px-6">
      <div className="w-full max-w-sm flex flex-col items-center gap-4 text-center">
        <h1 className="text-base font-medium text-[var(--text-title)]">Admin girişi</h1>
        {refused ? (
          <p className="text-sm text-[var(--text-subtitle)]">
            <strong className="text-[var(--text-title)] font-medium">{auth.user.email}</strong> hesabının buraya erişimi yok.
          </p>
        ) : (
          <p className="text-sm text-[var(--text-subtitle)]">Devam etmek için Google hesabınla giriş yap.</p>
        )}
        <button type="button" onClick={signIn} disabled={busy} className="inline-flex items-center gap-2 h-10 px-5 rounded-full border border-[var(--border)] bg-[var(--bg-2)] text-sm font-medium text-[var(--text-title)] hover:bg-[var(--bg-4)] cursor-pointer disabled:opacity-60 disabled:cursor-default">
          <GoogleMark />
          {busy ? "Giriş yapılıyor…" : refused ? "Başka bir hesapla gir" : "Google ile giriş yap"}
        </button>
        {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
        <Link href="/" className="inline-flex items-center gap-1 mt-4 text-sm text-[var(--text-subtitle)] hover:text-[var(--text-p)]">
          <span className="flex items-center justify-center w-4 h-4"><ArrowLeftIcon className="w-4 h-4" /></span>
          Siteye dön
        </Link>
      </div>
    </main>
  );
}
