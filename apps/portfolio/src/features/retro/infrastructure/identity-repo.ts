import { isNil } from 'lodash-es';

/**
 * Runtime identity surfaced to retro UI. `clientId` is the only piece
 * we persist locally — it must stay stable across reloads so awareness
 * events can be attributed to the same "user" on the same device. The
 * display name and avatar are derived from the OIDC session and never
 * touch localStorage.
 */
export interface IRetroIdentity {
  readonly clientId: number;
  readonly name: string;
  readonly pictureUrl?: string;
}

const STORAGE_KEY = 'retro:identity';

/**
 * Safe upper bound for a 32-bit signed integer — matches the numeric
 * range of Yjs awareness client ids, keeping interop predictable.
 */
const MAX_RANDOM_CLIENT_ID = 2_147_483_647;

export interface IIdentityRepo {
  /**
   * Reads the persisted `clientId`, generating + storing a fresh one
   * on first visit. Old localStorage entries (which used to carry a
   * `{ clientId, name, color }` envelope) are migrated transparently
   * by extracting just the `clientId` field.
   */
  getOrCreateClientId(): number;
  clear(): void;
}

export function createIdentityRepo(storage: Storage = localStorage): IIdentityRepo {
  return {
    getOrCreateClientId(): number {
      const raw = storage.getItem(STORAGE_KEY);
      if (!isNil(raw)) {
        const existing = readClientId(raw);
        if (existing !== null) {
          return existing;
        }
      }
      const next = generateClientId();
      storage.setItem(STORAGE_KEY, JSON.stringify({ clientId: next }));
      return next;
    },

    clear(): void {
      storage.removeItem(STORAGE_KEY);
    },
  };
}

function readClientId(raw: string): number | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as { clientId?: unknown }).clientId === 'number' &&
      Number.isFinite((parsed as { clientId: number }).clientId)
    ) {
      return (parsed as { clientId: number }).clientId;
    }
  } catch {
    // Fall through to null — malformed entry forces a fresh id.
  }
  return null;
}

function generateClientId(): number {
  return Math.floor(Math.random() * MAX_RANDOM_CLIENT_ID);
}
