import type { Milliseconds } from '@frozik/utils/date/types';
import { z } from 'zod';

import type { IKnownVault, IVaultRegistry } from '../ports';
import type { TRunInDatabase } from './device-database';

const KNOWN_VAULT_SCHEMA = z.object({
  vaultKey: z.string(),
  name: z.string(),
  description: z.string().catch(''),
  lastOpenedAt: z.number().nullable(),
  unsyncedChanges: z.boolean(),
});

function readKnownVault(entry: unknown): readonly IKnownVault[] {
  const parsed = KNOWN_VAULT_SCHEMA.safeParse(entry);
  return parsed.success
    ? [{ ...parsed.data, lastOpenedAt: parsed.data.lastOpenedAt as Milliseconds | null }]
    : [];
}

/** Open records read through a schema; an entry this version cannot read is skipped, not fatal. */
export function createVaultRegistry(run: TRunInDatabase): IVaultRegistry {
  return {
    list: () => run(async database => (await database.getAll('registry')).flatMap(readKnownVault)),
    put: ({ vaultKey, name, description, lastOpenedAt, unsyncedChanges }) =>
      run(
        async database =>
          void (await database.put(
            'registry',
            { vaultKey, name, description, lastOpenedAt, unsyncedChanges },
            vaultKey
          ))
      ),
    remove: vaultKey => run(database => database.delete('registry', vaultKey)),
  };
}
