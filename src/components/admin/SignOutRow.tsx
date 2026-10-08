"use client";

import { signOutUser, useAuth } from "@/lib/auth";

/** The admin home's last row: who is signed in, and signing out (the admin's pages then send to the sign-in page). */
export function SignOutRow() {
  const auth = useAuth();
  if (auth.status !== "signed-in") return null;
  return (
    <button
      type="button"
      onClick={() => void signOutUser()}
      className="group flex items-center justify-between w-full py-[10px] text-left cursor-pointer transition-all duration-150 hover:bg-[var(--bg-3)]"
    >
      <span className="flex flex-col flex-1 min-w-0">
        <span className="text-base font-medium leading-5 text-[var(--text-title)]">Çıkış yap</span>
        <span className="text-base font-normal leading-6 text-[var(--text-subtitle)] truncate">{auth.user.email}</span>
      </span>
    </button>
  );
}
