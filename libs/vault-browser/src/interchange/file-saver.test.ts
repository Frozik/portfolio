import { saveFile } from './file-saver';

const FILE = { name: 'vault.csv', mime: 'text/csv', bytes: Uint8Array.of(1, 2, 3) };

function withShareSheet(share: (data: ShareData) => Promise<void>): void {
  vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share });
}

describe('saving a file without a save picker', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hands it to the share sheet', async () => {
    const shared: File[] = [];
    withShareSheet(data => {
      shared.push(...(data.files ?? []));
      return Promise.resolve();
    });

    const saved = await saveFile(FILE);

    expect(saved).toBe('saved');
    expect(shared.map(file => [file.name, file.type])).toEqual([['vault.csv', 'text/csv']]);
  });

  it('takes a closed share sheet as a cancel', async () => {
    withShareSheet(() => Promise.reject(new DOMException('closed', 'AbortError')));

    expect(await saveFile(FILE)).toBe('cancelled');
  });
});
