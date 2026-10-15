import { SECURE_STORE_QUICK_KEEP } from './secure-store-quick-keep';

const mockItems = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  setItem: jest.fn((key: string, value: string) => void mockItems.set(key, value)),
  getItem: jest.fn((key: string) => mockItems.get(key) ?? null),
}));

const VAULT = 'a1b2';

describe('the quick lock kept in the Keystore', () => {
  beforeEach(() => mockItems.clear());

  it('gives back what was kept, per vault', () => {
    SECURE_STORE_QUICK_KEEP.write(VAULT, '{"kept":true}');

    expect([SECURE_STORE_QUICK_KEEP.read(VAULT), SECURE_STORE_QUICK_KEEP.read('c3d4')]).toEqual([
      '{"kept":true}',
      null,
    ]);
  });

  it('reads nothing once removed, at once and without waiting', () => {
    SECURE_STORE_QUICK_KEEP.write(VAULT, '{"kept":true}');

    SECURE_STORE_QUICK_KEEP.remove(VAULT);

    expect(SECURE_STORE_QUICK_KEEP.read(VAULT)).toBeNull();
  });
});
