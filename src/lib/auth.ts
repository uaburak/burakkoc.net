"use client";

import { useEffect, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

/**
 * Who may use the admin: these Google accounts (their verified emails). The
 * same list is in firestore.rules and storage.rules — what really keeps the
 * data safe; this one only decides what the admin's pages show.
 */
export const ADMIN_EMAILS = ["design.burakkoc@gmail.com"];

/**
 * Local development without signing in (`NEXT_PUBLIC_ADMIN_DEV_BYPASS=1` in
 * .env.local): the admin's pages open as if signed in — on the dev server
 * only, never in a build. Writes still need the rules to allow them.
 */
export const DEV_BYPASS = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ADMIN_DEV_BYPASS === "1";

export const isAdmin = (user: User | null) => Boolean(user?.email && user.emailVerified && ADMIN_EMAILS.includes(user.email.toLowerCase()));

export type AuthState = { status: "loading" } | { status: "signed-out" } | { status: "signed-in"; user: User; admin: boolean } | { status: "bypass" };

/** The signed-in user, as Firebase Auth tells it (it remembers the sign-in in the browser). */
export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(() => (DEV_BYPASS ? { status: "bypass" } : { status: "loading" }));
  useEffect(() => {
    if (DEV_BYPASS) return;
    return onAuthStateChanged(auth, (user) => setState(user ? { status: "signed-in", user, admin: isAdmin(user) } : { status: "signed-out" }));
  }, []);
  return state;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(auth, provider);
}

export const signOutUser = () => signOut(auth);
