"use client";

/**
 * The person using the editor, for the account button at the panel's corner.
 * There is no sign-in yet: this is where Firebase Auth plugs in — return its
 * user's photo and name (`user.photoURL`, `user.displayName`) and the button
 * shows them, nothing else in the editor changes.
 */
export interface Account {
  photoURL: string | null;
  name: string | null;
}

export function useAccount(): Account {
  return { photoURL: null, name: null };
}
