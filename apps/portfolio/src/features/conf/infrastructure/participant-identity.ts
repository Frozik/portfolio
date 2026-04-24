import type { ParticipantId } from '../domain/types';

const LOCAL_STORAGE_KEY = 'frozik-conf-participant-id';

/**
 * Return the stable `ParticipantId` for this browser, generating and
 * persisting a fresh UUID on first use. The id is stored in
 * `localStorage` so it survives page reloads, tab closes, and network
 * drops — enough for reconnect detection but still anonymous, since
 * nothing else ties the id to a human.
 *
 * Fallback: when `localStorage` is unavailable (private-mode Safari or
 * hardened profiles) an ephemeral id is generated instead so the feature
 * still works — reconnect detection won't fire for the affected tab.
 */
export function getOrCreateParticipantId(): ParticipantId {
  try {
    const existing = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (existing !== null && existing.length > 0) {
      return existing as ParticipantId;
    }
    const next = crypto.randomUUID();
    window.localStorage.setItem(LOCAL_STORAGE_KEY, next);
    return next as ParticipantId;
  } catch {
    return crypto.randomUUID() as ParticipantId;
  }
}
