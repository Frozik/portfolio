import { lockConsequence } from './lock-policy';

const FULL_EVERYWHERE = { level: 'full', wipe: true, tellPeers: true, flushClipboard: true };
const FULL_HERE = { ...FULL_EVERYWHERE, tellPeers: false };

describe('a lock', () => {
  it.each(['complete', 'rollback-security', 'forgotten', 'update-required'] as const)(
    'for %s locks every client fully and wipes',
    reason => {
      expect(lockConsequence(reason, true)).toEqual(FULL_EVERYWHERE);
    }
  );

  it('for the lock button is quick once quick unlock is ready, as Bitwarden locks, else full everywhere', () => {
    expect(lockConsequence('manual', true)).toEqual({
      level: 'quick',
      wipe: false,
      tellPeers: true,
      flushClipboard: true,
    });
    expect(lockConsequence('manual', false)).toEqual(FULL_EVERYWHERE);
  });

  it.each(['idle', 'concealed', 'sleep'] as const)(
    'for %s is quick once quick unlock is ready, keeping the process',
    reason => {
      expect(lockConsequence(reason, true)).toEqual({
        level: 'quick',
        wipe: false,
        tellPeers: false,
        flushClipboard: true,
      });
      expect(lockConsequence(reason, false)).toEqual(FULL_HERE);
    }
  );

  it.each(['resumed', 'other-client', 'quick-unlock-failed', 'quick-expired'] as const)(
    'for %s locks only its own client, fully',
    reason => {
      expect(lockConsequence(reason, true)).toEqual(FULL_HERE);
    }
  );

  it('leaves the process alone when the user left the vault, but clears a copy', () => {
    expect(lockConsequence('left', true)).toEqual({
      level: 'full',
      wipe: false,
      tellPeers: false,
      flushClipboard: true,
    });
  });

  it('touches neither the process nor the clipboard when the process is going away', () => {
    expect(lockConsequence('unloading', true)).toEqual({
      level: 'full',
      wipe: false,
      tellPeers: false,
      flushClipboard: false,
    });
  });
});
