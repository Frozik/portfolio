import { scanFromURLAsync } from 'expo-camera';

import { mlKitReadQrCode } from './ml-kit-qr-reader';

const mockFiles = new Map<string, Uint8Array>();

jest.mock('expo-camera', () => ({ scanFromURLAsync: jest.fn() }));

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

const PICTURE = { bytes: Uint8Array.of(1, 2, 3), mime: 'image/png' };

describe('reading a QR code from a picture on the phone', () => {
  beforeEach(() => mockFiles.clear());

  it('gives the QR text and leaves no copy of the picture in the cache', async () => {
    let read: readonly number[] = [];
    jest.mocked(scanFromURLAsync).mockImplementation(async uri => {
      read = [...(mockFiles.get(uri) ?? [])];
      return [{ type: 'qr', data: 'otpauth://totp/Bank?secret=JBSWY3DPEHPK3PXP' }] as Awaited<
        ReturnType<typeof scanFromURLAsync>
      >;
    });

    const text = await mlKitReadQrCode(PICTURE);

    expect({ text, read, left: mockFiles.size }).toEqual({
      text: 'otpauth://totp/Bank?secret=JBSWY3DPEHPK3PXP',
      read: [1, 2, 3],
      left: 0,
    });
  });

  it('finds no code when the picture cannot be read, and leaves nothing behind', async () => {
    jest.mocked(scanFromURLAsync).mockRejectedValue(new Error('not an image'));

    expect({ text: await mlKitReadQrCode(PICTURE), left: mockFiles.size }).toEqual({
      text: null,
      left: 0,
    });
  });
});
