import type { SQLiteDatabase } from 'expo-sqlite';

/** The app's own key-value table: the group book, the preferences and the rest, one row each. */
export class SqliteStore {
  constructor(private readonly database: SQLiteDatabase) {
    database.execSync(
      'CREATE TABLE IF NOT EXISTS documents (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)'
    );
  }

  async read(key: string): Promise<string | null> {
    const row = await this.database.getFirstAsync<{ readonly value: string }>(
      'SELECT value FROM documents WHERE key = ?',
      key
    );
    return row?.value ?? null;
  }

  async remove(key: string): Promise<void> {
    await this.database.runAsync('DELETE FROM documents WHERE key = ?', key);
  }

  async write(key: string, value: string): Promise<void> {
    await this.database.runAsync(
      'INSERT OR REPLACE INTO documents (key, value) VALUES (?, ?)',
      key,
      value
    );
  }
}
