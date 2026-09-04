import { parseJson } from '@frozik/utils/parseJson';
import { isNil } from 'lodash-es';

import { getOrCreatePersistentId } from '../../../shared/lib/getOrCreatePersistentId';

/**
 * Runtime identity surfaced to the retro UI. Only `clientId` is persisted, so
 * awareness events stay attributable to the same person on the same device;
 * name and avatar come from the OIDC session.
 */
export interface IRetroIdentity {
  readonly clientId: number;
  readonly name: string;
  readonly pictureUrl?: string;
}

const STORAGE_KEY = 'retro:identity';
/** Matches the 32-bit range of Yjs awareness client ids. */
const MAX_RANDOM_CLIENT_ID = 2_147_483_647;

export interface IIdentityRepo {
  /** The persisted `clientId`, minted and stored on the first visit. */
  getOrCreateClientId(): number;
  clear(): void;
}

export function createIdentityRepo(storage: Storage = localStorage): IIdentityRepo {
  return {
    getOrCreateClientId(): number {
      return getOrCreatePersistentId({
        key: STORAGE_KEY,
        generate: generateClientId,
        parse: readClientId,
        serialize: clientId => JSON.stringify({ clientId }),
        storage,
      });
    },
    clear(): void {
      storage.removeItem(STORAGE_KEY);
    },
  };
}

/** Older entries carried a `{ clientId, name, color }` envelope; only the id is read. */
function readClientId(raw: string): number | undefined {
  const parsed = parseJson<unknown>(raw);
  if (isNil(parsed) || typeof parsed !== 'object' || !('clientId' in parsed)) {
    return undefined;
  }
  return typeof parsed.clientId === 'number' && Number.isFinite(parsed.clientId)
    ? parsed.clientId
    : undefined;
}

function generateClientId(): number {
  return Math.floor(Math.random() * MAX_RANDOM_CLIENT_ID);
}
