import type { IVaultRegistry } from '../ports';
import { readKnownVault } from '../stored-records';
import type { TRunInDatabase } from './device-database';

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
