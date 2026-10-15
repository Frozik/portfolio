import { getDocumentAsync } from 'expo-document-picker';

import { pickVaultFileFromDocuments } from './document-picker';

const mockCache = new Map<string, Uint8Array<ArrayBuffer>>();

jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

jest.mock('expo-file-system', () => ({
  File: class {
    readonly path: string;
    constructor(path: string) {
      this.path = path;
    }
    get exists(): boolean {
      return mockCache.has(this.path);
    }
    bytes(): Promise<Uint8Array<ArrayBuffer>> {
      return Promise.resolve(mockCache.get(this.path) ?? new Uint8Array(0));
    }
    delete(): void {
      mockCache.delete(this.path);
    }
  },
}));

describe('choosing a vault file', () => {
  it('reads the chosen file and leaves no copy in the cache', async () => {
    mockCache.set('file:///cache/Family.pwv', Uint8Array.of(7, 7));
    jest.mocked(getDocumentAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///cache/Family.pwv', name: 'Family.pwv', lastModified: 0 }],
    });

    const picked = await pickVaultFileFromDocuments();

    expect({ name: picked?.name, bytes: [...(picked?.bytes ?? [])], left: mockCache.size }).toEqual(
      {
        name: 'Family.pwv',
        bytes: [7, 7],
        left: 0,
      }
    );
  });

  it('gives nothing when the chooser was closed', async () => {
    jest.mocked(getDocumentAsync).mockResolvedValue({ canceled: true, assets: null });

    expect(await pickVaultFileFromDocuments()).toBeNull();
  });
});
