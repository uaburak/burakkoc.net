"use client";

import { signOutUser, useAuth } from "@/lib/auth";

/** The person using the editor, for the account button at the panel's corner: the signed-in Google account. */
export interface Account {
  photoURL: string | null;
  name: string | null;
  email: string | null;
  signOut: (() => void) | null;
}

export function useAccount(): Account {
  const auth = useAuth();
  if (auth.status !== "signed-in") return { photoURL: null, name: auth.status === "bypass" ? "Development (not signed in)" : null, email: null, signOut: null };
  return { photoURL: auth.user.photoURL, name: auth.user.displayName, email: auth.user.email, signOut: () => void signOutUser() };
}
