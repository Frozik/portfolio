import { parseJson } from '@frozik/utils';
import { isNil } from 'lodash-es';

/**
 * Local-only identity of the current participant. The `clientId` is a
 * stable number that survives page reloads so awareness events can be
 * attributed to the same "user" across sessions on the same device.
 *
 * This repo intentionally lives in localStorage (not IndexedDB) — it is
 * tiny, must be synchronously readable on boot, and never synced between
 * tabs of the same browser as each tab is treated as a distinct client.
 */
export interface IRetroIdentity {
  readonly clientId: number;
  readonly name: string;
  readonly color: string;
}

const STORAGE_KEY = 'retro:identity';

/**
 * Safe upper bound for a 32-bit signed integer — matches the numeric
 * range of Yjs awareness client ids, keeping interop predictable.
 */
const MAX_RANDOM_CLIENT_ID = 2_147_483_647;

const DEFAULT_COLORS: readonly string[] = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
];

export interface IIdentityRepo {
  load(): IRetroIdentity | null;
  save(identity: IRetroIdentity): void;
  clear(): void;
  getOrCreate(defaultName: string): IRetroIdentity;
}

export function createIdentityRepo(storage: Storage = localStorage): IIdentityRepo {
  return {
    load(): IRetroIdentity | null {
      const raw = storage.getItem(STORAGE_KEY);

      if (isNil(raw)) {
        return null;
      }

      const parsed = parseJson<unknown>(raw);

      if (isNil(parsed) || !isValidIdentity(parsed)) {
        return null;
      }

      return parsed;
    },

    save(identity: IRetroIdentity): void {
      storage.setItem(STORAGE_KEY, JSON.stringify(identity));
    },

    clear(): void {
      storage.removeItem(STORAGE_KEY);
    },

    getOrCreate(defaultName: string): IRetroIdentity {
      const raw = storage.getItem(STORAGE_KEY);

      if (!isNil(raw)) {
        const parsed = parseJson<unknown>(raw);

        if (!isNil(parsed) && isValidIdentity(parsed)) {
          return parsed;
        }
      }

      const identity: IRetroIdentity = {
        clientId: generateClientId(),
        name: defaultName,
        color: pickRandomColor(),
      };

      storage.setItem(STORAGE_KEY, JSON.stringify(identity));

      return identity;
    },
  };
}

function generateClientId(): number {
  return Math.floor(Math.random() * MAX_RANDOM_CLIENT_ID);
}

function pickRandomColor(): string {
  const index = Math.floor(Math.random() * DEFAULT_COLORS.length);
  return DEFAULT_COLORS[index] ?? DEFAULT_COLORS[0] ?? '#3b82f6';
}

function isValidIdentity(candidate: unknown): candidate is IRetroIdentity {
  if (isNil(candidate) || typeof candidate !== 'object') {
    return false;
  }

  const record = candidate as Record<string, unknown>;

  return (
    typeof record.clientId === 'number' &&
    Number.isFinite(record.clientId) &&
    typeof record.name === 'string' &&
    typeof record.color === 'string'
  );
}
