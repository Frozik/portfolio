import { unlockFailureOf } from './unlock-failure';

describe('unlockFailureOf', () => {
  it('tells a wrong password from a damaged file and from a failed worker', () => {
    expect(unlockFailureOf({ kind: 'wrong-password' })).toBe('wrong-password');
    expect(unlockFailureOf({ kind: 'slot-tampered' })).toBe('slot-tampered');
    expect(unlockFailureOf({ kind: 'zip-limits' })).toBe('corrupted');
    expect(unlockFailureOf({ kind: 'worker-crashed' })).toBe('unavailable');
  });
});
