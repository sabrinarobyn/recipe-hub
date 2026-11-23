/** A Member's Profile, as other Members see it: never their email. */
export interface Profile {
  userId: string;
  displayName: string | null;
  /** Small JPEG data URL, or null until they set one. */
  photo: string | null;
  /** When they were first asked for a display name (answered or skipped). */
  nameAskedAt: string | null;
}

/** Up to two letters for a Member with no Profile photo: first and last name, or "?" with no name. */
export function initials(name: string | null): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const first = words[0];
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  return [first, last].map((w) => (w ? [...w][0].toUpperCase() : "")).join("");
}

/** On sign-in, ask for a display name once: not if they have one, and not again after they skipped. */
export function shouldAskForName(profile: Profile | undefined): boolean {
  return !profile?.displayName && !profile?.nameAskedAt;
}
