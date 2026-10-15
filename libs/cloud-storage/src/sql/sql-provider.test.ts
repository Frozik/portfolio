import { createNodeSqliteDriver } from '@frozik/utils/sql/testing/node-sqlite-driver';

import { storagePath } from '../core/storage-path';
import { describeStorageProviderContract } from '../testing/storage-contract';
import { createSqlProvider } from './sql-provider';

describeStorageProviderContract('sql', () =>
  createSqlProvider({ driver: createNodeSqliteDriver(), namespace: 'vault' })
);

const FILE = storagePath('main.pwv');

describe('the sql provider', () => {
  it('keeps the providers of one database apart', async () => {
    const driver = createNodeSqliteDriver();
    const signal = new AbortController().signal;
    const first = createSqlProvider({ driver, namespace: 'first' });
    const second = createSqlProvider({ driver, namespace: 'second' });

    await first.write(FILE, Uint8Array.of(1), { kind: 'absent' }, signal);

    expect(await second.read(FILE, signal)).toEqual({ ok: true, value: null });
  });
});
