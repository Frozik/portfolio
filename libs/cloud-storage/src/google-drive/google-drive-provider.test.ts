import { storagePath } from '../core/storage-path';
import { describeStorageProviderContract } from '../testing/storage-contract';
import type { TDriveSpace } from './drive-space';
import { createDriveTransport } from './drive-transport';
import { createFakeDriveServer, fakeTokenSource } from './fake-drive-server.test-helper';
import { createGoogleDriveProvider } from './google-drive-provider';

const SIGNAL = new AbortController().signal;
const FILE = storagePath('Vault/main.pwv');

function driveOver(space: TDriveSpace, server = createFakeDriveServer()) {
  const tokens = fakeTokenSource();
  const provider = createGoogleDriveProvider({
    transport: createDriveTransport(tokens, server.fetch),
    space,
  });
  return { server, tokens, provider };
}

describeStorageProviderContract('google drive, My Drive', () => driveOver('my-drive').provider);
describeStorageProviderContract('google drive, app data', () => driveOver('app-data').provider);

describe('google drive storage provider', () => {
  it('keeps a vault in My Drive visible, and one in app data out of the user’s sight', async () => {
    const server = createFakeDriveServer();
    await driveOver('my-drive', server).provider.write(
      FILE,
      Uint8Array.of(1),
      { kind: 'absent' },
      SIGNAL
    );
    await driveOver('app-data', server).provider.write(
      storagePath('Vault/hidden.pwv'),
      Uint8Array.of(2),
      { kind: 'absent' },
      SIGNAL
    );

    expect(server.paths('drive')).toEqual(['Vault', 'Vault/main.pwv']);
    expect(server.paths('appDataFolder')).toEqual(['Vault', 'Vault/hidden.pwv']);
    expect(
      await driveOver('my-drive', server).provider.stat(storagePath('Vault/hidden.pwv'), SIGNAL)
    ).toEqual({
      ok: true,
      value: null,
    });
  });

  it('gives way to a create another device landed first, and removes its own copy', async () => {
    const { server, provider } = driveOver('my-drive');
    await provider.write(
      storagePath('Vault/other.pwv'),
      Uint8Array.of(0),
      { kind: 'absent' },
      SIGNAL
    );
    server.duringNextUpload(() => server.putAnother('Vault', 'main.pwv', Uint8Array.of(9)));

    const raced = await provider.write(FILE, Uint8Array.of(1), { kind: 'absent' }, SIGNAL);
    const read = await provider.read(FILE, SIGNAL);

    expect(raced.ok && raced.value.kind).toBe('conflict');
    expect(read).toMatchObject({ ok: true, value: { bytes: Uint8Array.of(9) } });
    expect(server.paths('drive').filter(path => path === 'Vault/main.pwv')).toHaveLength(1);
  });

  it('waits when Drive asks to slow down, and reports a full Drive as such', async () => {
    const { server, provider } = driveOver('my-drive');

    server.failNextWith(403, 'userRateLimitExceeded');
    const slowed = await provider.stat(FILE, SIGNAL);
    server.failNextWith(403, 'storageQuotaExceeded');
    const full = await provider.stat(FILE, SIGNAL);

    expect(slowed).toEqual({ ok: false, error: { kind: 'rate-limited', retryAfter: null } });
    expect(full).toEqual({ ok: false, error: { kind: 'quota' } });
  });

  it('drops a token Google refused, so the next call asks the user again', async () => {
    const { server, tokens, provider } = driveOver('my-drive');

    server.failNextWith(401, 'authError');
    const refused = await provider.stat(FILE, SIGNAL);

    expect(refused).toEqual({ ok: false, error: { kind: 'auth-required' } });
    expect(tokens.invalidated()).toBe(1);
  });
});
