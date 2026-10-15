import { credentialsOffered } from './credentials-offered';

const BOTH = { passkey: true, biometric: true };
const NONE = { passkey: false, biometric: false };

describe('the credentials a locked vault offers', () => {
  it('are the code first at a quick lock, then the other ways in', () => {
    expect(credentialsOffered({ level: 'quick', reason: 'idle' }, BOTH)).toEqual([
      'quick-code',
      'biometric',
      'passkey',
      'password',
      'recovery-key',
    ]);
  });

  it('are what this device has set up, and the master password, at a full lock', () => {
    expect(
      credentialsOffered({ level: 'full', reason: 'manual' }, { ...NONE, passkey: true })
    ).toEqual(['passkey', 'password', 'recovery-key']);
    expect(credentialsOffered({ level: 'full', reason: null }, NONE)).toEqual([
      'password',
      'recovery-key',
    ]);
  });

  it('are only the master password and the recovery key after a failed quick code', () => {
    expect(credentialsOffered({ level: 'full', reason: 'quick-unlock-failed' }, BOTH)).toEqual([
      'password',
      'recovery-key',
    ]);
  });
});
