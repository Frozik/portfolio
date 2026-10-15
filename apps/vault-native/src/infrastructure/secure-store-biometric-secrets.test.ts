import { SecurityLevel } from 'expo-local-authentication';
import { getItemAsync } from 'expo-secure-store';

import { SECURE_STORE_BIOMETRIC_SECRETS } from './secure-store-biometric-secrets';

const mockItems = new Map<string, string>();

jest.mock('expo-local-authentication', () => ({
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  getEnrolledLevelAsync: jest.fn(() => Promise.resolve(2)),
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async (key: string, value: string) => void mockItems.set(key, value)),
  getItemAsync: jest.fn(async (key: string) => mockItems.get(key) ?? null),
  deleteItemAsync: jest.fn(async (key: string) => void mockItems.delete(key)),
}));

const VAULT = 'a1b2';

describe('the Keystore behind the biometric prompt', () => {
  beforeEach(() => mockItems.clear());

  it('gives back the kept secret after the prompt', async () => {
    await SECURE_STORE_BIOMETRIC_SECRETS.put(VAULT, Uint8Array.of(1, 2, 3));

    const taken = await SECURE_STORE_BIOMETRIC_SECRETS.take(VAULT);

    expect(taken.ok && [...taken.value]).toEqual([1, 2, 3]);
  });

  it('calls a kept secret that reads back as nothing invalidated: a new finger was enrolled', async () => {
    await SECURE_STORE_BIOMETRIC_SECRETS.put(VAULT, Uint8Array.of(1));
    mockItems.delete(`vault-secret.${VAULT}`);

    expect(await SECURE_STORE_BIOMETRIC_SECRETS.take(VAULT)).toEqual({
      ok: false,
      error: 'invalidated',
    });
  });

  it('tells a closed prompt from a failure', async () => {
    jest
      .mocked(getItemAsync)
      .mockRejectedValueOnce(new Error('User canceled the authentication. Cancel'))
      .mockRejectedValueOnce(new Error('Lockout. Too many attempts'));

    const outcomes = [
      await SECURE_STORE_BIOMETRIC_SECRETS.take(VAULT),
      await SECURE_STORE_BIOMETRIC_SECRETS.take(VAULT),
    ];

    expect(outcomes).toEqual([
      { ok: false, error: 'cancelled' },
      { ok: false, error: 'unavailable' },
    ]);
  });

  it('reports weak face unlock as weak', async () => {
    expect(await SECURE_STORE_BIOMETRIC_SECRETS.available()).toBe('weak');
    expect(SecurityLevel.BIOMETRIC_WEAK).toBe(2);
  });

  it('forgets the secret and the mark that it was kept', async () => {
    await SECURE_STORE_BIOMETRIC_SECRETS.put(VAULT, Uint8Array.of(1));

    await SECURE_STORE_BIOMETRIC_SECRETS.forget(VAULT);

    expect(await SECURE_STORE_BIOMETRIC_SECRETS.has(VAULT)).toBe(false);
  });
});
