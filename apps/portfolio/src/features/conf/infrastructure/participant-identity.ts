import { getOrCreatePersistentId } from '../../../shared/lib/getOrCreatePersistentId';
import type { ParticipantId } from '../domain/types';

const LOCAL_STORAGE_KEY = 'frozik-conf-participant-id';

/**
 * Stable per-browser `ParticipantId`, persisted in `localStorage` so it
 * survives reloads/reconnects while staying anonymous. Storage-unavailable
 * profiles fall back to an ephemeral id (reconnect detection won't fire).
 */
export function getOrCreateParticipantId(): ParticipantId {
  return getOrCreatePersistentId<ParticipantId>({
    key: LOCAL_STORAGE_KEY,
    generate: () => crypto.randomUUID() as ParticipantId,
    parse: raw => (raw.length > 0 ? (raw as ParticipantId) : null),
    serialize: id => id,
  });
}
