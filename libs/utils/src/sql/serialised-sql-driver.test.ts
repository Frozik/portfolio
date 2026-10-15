import { createNodeSqliteDriver } from './testing/node-sqlite-driver';

async function counterDriver() {
  const driver = createNodeSqliteDriver();
  await driver.run('CREATE TABLE counter (value INTEGER NOT NULL)');
  await driver.run('INSERT INTO counter (value) VALUES (0)');
  return driver;
}

describe('a serialised SQL driver', () => {
  it('lets no other statement in while a transaction awaits', async () => {
    const driver = await counterDriver();
    let releaseTransaction = (): void => undefined;
    const held = new Promise<void>(resolve => {
      releaseTransaction = resolve;
    });

    const transaction = driver.transaction(async tx => {
      await tx.run('UPDATE counter SET value = 1');
      await held;
      await tx.run('UPDATE counter SET value = 2');
    });
    const outsider = driver.all('SELECT value FROM counter');
    releaseTransaction();
    await transaction;

    expect(await outsider).toEqual([{ value: 2 }]);
  });

  it('keeps a statement that arrives while a transaction awaits out of its rollback', async () => {
    const driver = await counterDriver();
    await driver.run('CREATE TABLE log (entry INTEGER NOT NULL)');
    let failTransaction = (): void => undefined;
    const held = new Promise<void>((_resolve, reject) => {
      failTransaction = () => reject(new Error('refused'));
    });
    let begun = (): void => undefined;
    const inside = new Promise<void>(resolve => {
      begun = resolve;
    });

    const transaction = driver.transaction(async tx => {
      await tx.run('UPDATE counter SET value = 1');
      begun();
      await held;
    });
    await inside;
    const outsider = driver.run('INSERT INTO log (entry) VALUES (42)');
    failTransaction();
    await expect(transaction).rejects.toThrow();
    await outsider;

    expect(await driver.all('SELECT entry FROM log')).toEqual([{ entry: 42 }]);
  });

  it('rolls back all of a failed transaction and throws its failure on', async () => {
    const driver = await counterDriver();
    const failure = new Error('refused');

    const outcome = driver.transaction(async tx => {
      await tx.run('UPDATE counter SET value = 1');
      throw failure;
    });

    await expect(outcome).rejects.toBe(failure);
    expect(await driver.all('SELECT value FROM counter')).toEqual([{ value: 0 }]);
  });

  it('keeps serving after a failed transaction', async () => {
    const driver = await counterDriver();

    await expect(driver.transaction(() => Promise.reject(new Error('refused')))).rejects.toThrow();
    await driver.run('UPDATE counter SET value = 3');

    expect(await driver.all('SELECT value FROM counter')).toEqual([{ value: 3 }]);
  });
});
