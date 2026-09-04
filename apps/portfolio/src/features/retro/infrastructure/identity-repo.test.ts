import { createIdentityRepo } from './identity-repo';

class MemoryStorage implements Storage {
  private readonly entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.entries.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }
}

const STORAGE_KEY = 'retro:identity';

describe('identity repo', () => {
  it('keeps the same client id across reads', () => {
    const repo = createIdentityRepo(new MemoryStorage());

    expect(repo.getOrCreateClientId()).toBe(repo.getOrCreateClientId());
  });

  it('reads the id out of a legacy envelope that also carried a name and colour', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ clientId: 42, name: 'Ada', color: '#fff' }));

    expect(createIdentityRepo(storage).getOrCreateClientId()).toBe(42);
  });

  it('replaces a malformed entry with a fresh id instead of failing', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEY, '{not json');

    const clientId = createIdentityRepo(storage).getOrCreateClientId();

    expect(Number.isInteger(clientId)).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).toBe(JSON.stringify({ clientId }));
  });
});
