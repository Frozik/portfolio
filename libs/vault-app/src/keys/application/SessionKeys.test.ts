import { createMemoryProvider } from '@frozik/cloud-storage/memory/memory-provider';
import { createInThreadCodec } from '@frozik/vault/codec/in-thread-codec';
import type { IVaultCodec } from '@frozik/vault/codec/vault-codec';
import { aVault } from '@frozik/vault/testing/vault-file-fixtures';

import { SessionKeys } from './SessionKeys';

const PASSWORD = 'correct horse battery staple';

describe('the session’s keys', () => {
  it('finish a password change while a file with the same slots comes in', async () => {
    const { keys, dependencies } = await aVault();
    const codec = createInThreadCodec(dependencies);
    let release: () => void = () => undefined;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    const slowCodec: IVaultCodec = {
      ...codec,
      changePassword: async (...args) => {
        await held;
        return codec.changePassword(...args);
      },
    };
    const sessionKeys = new SessionKeys(keys, 'password', {
      codec: slowCodec,
      localCopy: createMemoryProvider(),
      signal: new AbortController().signal,
      onChanged: () => undefined,
      onPasswordChanged: () => undefined,
    });

    const changing = sessionKeys.change(
      { kind: 'password', password: PASSWORD },
      'a new long password'
    );
    sessionKeys.adopt({ ...keys, preserved: [] });
    release();

    expect(await changing).toBeNull();
    expect(sessionKeys.current.keyslotsEpoch).toBe(keys.keyslotsEpoch + 1);
  });
});
