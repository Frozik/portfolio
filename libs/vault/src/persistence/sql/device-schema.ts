import type { ISqlDriver } from '@frozik/utils/sql/sql-driver';

/** Every table of the device stores; the sealed ones hold only ciphertext. */
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS vault_registry (vault_key TEXT PRIMARY KEY, record TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sync_state (vault_key TEXT PRIMARY KEY, record TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS device (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sealed_records (
    store TEXT NOT NULL,
    vault_key TEXT NOT NULL,
    record_key TEXT NOT NULL,
    sealed BLOB NOT NULL,
    PRIMARY KEY (store, vault_key, record_key)
  )`,
  `CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_key TEXT NOT NULL,
    taken_at INTEGER NOT NULL,
    reason TEXT NOT NULL,
    size INTEGER NOT NULL,
    file BLOB NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS snapshots_by_vault ON snapshots (vault_key, id)`,
] as const;

export const DEVICE_TABLES = [
  'vault_registry',
  'sync_state',
  'device',
  'sealed_records',
  'snapshots',
] as const;

export async function createDeviceSchema(driver: ISqlDriver): Promise<void> {
  for (const statement of STATEMENTS) {
    await driver.run(statement);
  }
}
