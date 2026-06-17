const INITIALS_PART_LIMIT = 2;

/** Placeholder initial for participants with no resolvable display name. */
export const UNKNOWN_PARTICIPANT_INITIAL = '?';

/**
 * Derive up-to-two uppercase initials from a display name: the first letter of
 * the first two whitespace-separated parts, or the first two letters of a
 * single-word name. Empty names collapse to {@link UNKNOWN_PARTICIPANT_INITIAL}.
 */
export function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return UNKNOWN_PARTICIPANT_INITIAL;
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return (parts[0] ?? UNKNOWN_PARTICIPANT_INITIAL).slice(0, INITIALS_PART_LIMIT).toUpperCase();
  }
  return `${parts[0]?.charAt(0) ?? ''}${parts[1]?.charAt(0) ?? ''}`.toUpperCase();
}
