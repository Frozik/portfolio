import { createNodeSqliteDriver } from './node-sqlite-driver';

describe('the node:sqlite driver', () => {
  it('keeps bytes and numbers as they were written', async () => {
    const driver = createNodeSqliteDriver();
    await driver.run('CREATE TABLE t (id INTEGER PRIMARY KEY, data BLOB, label TEXT)');

    await driver.run('INSERT INTO t (id, data, label) VALUES (?, ?, ?)', [
      1,
      Uint8Array.of(0, 255),
      'x',
    ]);

    expect(await driver.all('SELECT id, data, label FROM t')).toEqual([
      { id: 1, data: Uint8Array.of(0, 255), label: 'x' },
    ]);
  });
});
