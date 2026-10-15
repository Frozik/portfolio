import { isAvailableAsync, shareAsync } from 'expo-sharing';

import { clearLeftoverExports, shareSheetSaveFile } from './share-sheet-file-saver';

const mockFiles = new Map<string, Uint8Array>();

jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache' } },
  Directory: class {
    readonly uri: string;
    constructor(parent: { uri: string }, name: string) {
      this.uri = `${parent.uri}/${name}`;
    }
    get exists(): boolean {
      return [...mockFiles.keys()].some(path => path.startsWith(`${this.uri}/`));
    }
    create(): void {}
    delete(): void {
      [...mockFiles.keys()]
        .filter(path => path.startsWith(`${this.uri}/`))
        .forEach(path => mockFiles.delete(path));
    }
  },
  File: class {
    readonly uri: string;
    constructor(parent: { uri: string }, name: string) {
      this.uri = `${parent.uri}/${name}`;
    }
    create(): void {
      mockFiles.set(this.uri, new Uint8Array(0));
    }
    write(bytes: Uint8Array): void {
      mockFiles.set(this.uri, bytes);
    }
  },
}));

const EXPORT = { name: 'vault.csv', mime: 'text/csv', bytes: Uint8Array.of(1, 2, 3) };

describe('saving through the share sheet', () => {
  beforeEach(() => mockFiles.clear());

  it('hands the bytes to the share sheet and leaves no copy in the cache', async () => {
    jest.mocked(isAvailableAsync).mockResolvedValue(true);
    let shared: readonly number[] = [];
    jest.mocked(shareAsync).mockImplementation(async uri => {
      shared = [...(mockFiles.get(uri) ?? [])];
    });

    const outcome = await shareSheetSaveFile(EXPORT);

    expect({ outcome, shared, left: mockFiles.size }).toEqual({
      outcome: 'saved',
      shared: [1, 2, 3],
      left: 0,
    });
  });

  it('says unavailable when the sheet fails, and deletes the cached copy all the same', async () => {
    jest.mocked(isAvailableAsync).mockResolvedValue(true);
    jest.mocked(shareAsync).mockRejectedValue(new Error('no activity'));

    const outcome = await shareSheetSaveFile(EXPORT);

    expect({ outcome, left: mockFiles.size }).toEqual({ outcome: 'unavailable', left: 0 });
  });

  it('clears at start an export a killed process left behind', () => {
    mockFiles.set('file:///cache/exports/vault.csv', Uint8Array.of(1));

    clearLeftoverExports();

    expect(mockFiles.size).toBe(0);
  });

  it('keeps a vault name with a slash from leaving the exports folder', async () => {
    jest.mocked(isAvailableAsync).mockResolvedValue(true);
    let sharedAt = '';
    jest.mocked(shareAsync).mockImplementation(async uri => {
      sharedAt = uri;
    });

    await shareSheetSaveFile({ ...EXPORT, name: 'Emergency Kit — Work/Home.txt' });

    expect(sharedAt).toBe('file:///cache/exports/Emergency Kit — Work-Home.txt');
  });

  it('says unavailable where nothing can share', async () => {
    jest.mocked(isAvailableAsync).mockResolvedValue(false);

    expect(await shareSheetSaveFile(EXPORT)).toBe('unavailable');
  });
});
