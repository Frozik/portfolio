import type { TKeyslot } from '../crypto/keyslot';
import { mergeKeyslots, sameKeyslots } from './keyslot-merge';

function aSlot(kind: TKeyslot['kind'], byte: number): TKeyslot {
  const sealing = {
    salt: new Uint8Array(16),
    wrapNonce: new Uint8Array(12),
    wrappedDek: new Uint8Array(48).fill(byte),
  };
  return kind === 'password'
    ? {
        kind,
        kdf: { kind: 'argon2id', params: { memoryKib: 1, iterations: 1, parallelism: 1 } },
        ...sealing,
      }
    : kind === 'prf'
      ? { kind, credentialId: Uint8Array.of(byte), ...sealing }
      : { kind, ...sealing };
}

const OLD_PASSWORD = aSlot('password', 1);
const NEW_PASSWORD = aSlot('password', 2);
const RECOVERY = aSlot('recovery', 3);

describe('merging slot sets changed on two devices', () => {
  it('keeps each side’s own change: a new password here, a recovery key there', () => {
    const base = [OLD_PASSWORD];
    const here = [NEW_PASSWORD];
    const there = [OLD_PASSWORD, RECOVERY];

    const merged = mergeKeyslots(base, { slots: here, epoch: 1 }, { slots: there, epoch: 1 });

    expect(sameKeyslots(merged, [NEW_PASSWORD, RECOVERY])).toBe(true);
    expect(
      sameKeyslots(
        mergeKeyslots(base, { slots: there, epoch: 1 }, { slots: here, epoch: 1 }),
        merged
      )
    ).toBe(true);
  });

  it('picks the same password on both devices when both changed it', () => {
    const other = aSlot('password', 0);
    const base = [OLD_PASSWORD];

    expect(
      mergeKeyslots(base, { slots: [NEW_PASSWORD], epoch: 1 }, { slots: [other], epoch: 1 })
    ).toEqual([other]);
    expect(
      mergeKeyslots(base, { slots: [other], epoch: 1 }, { slots: [NEW_PASSWORD], epoch: 1 })
    ).toEqual([other]);
  });

  it('without a base, keeps a slot one side added', () => {
    expect(
      sameKeyslots(
        mergeKeyslots(
          null,
          { slots: [OLD_PASSWORD], epoch: 1 },
          { slots: [OLD_PASSWORD, RECOVERY], epoch: 1 }
        ),
        [OLD_PASSWORD, RECOVERY]
      )
    ).toBe(true);
  });

  it('keeps a passkey added on each device, and drops one removed on either', () => {
    const laptop = aSlot('prf', 4);
    const phone = aSlot('prf', 5);
    const old = aSlot('prf', 6);
    const base = [OLD_PASSWORD, old];
    const here = [OLD_PASSWORD, old, laptop];
    const there = [OLD_PASSWORD, phone];

    const merged = mergeKeyslots(base, { slots: here, epoch: 1 }, { slots: there, epoch: 1 });

    expect(sameKeyslots(merged, [OLD_PASSWORD, laptop, phone])).toBe(true);
    expect(
      sameKeyslots(
        mergeKeyslots(base, { slots: there, epoch: 1 }, { slots: here, epoch: 1 }),
        merged
      )
    ).toBe(true);
  });

  it('lets the later epoch win when both changed the same slot', () => {
    const newest = aSlot('password', 9);

    expect(
      mergeKeyslots(
        [OLD_PASSWORD],
        { slots: [newest], epoch: 3 },
        { slots: [NEW_PASSWORD], epoch: 2 }
      )
    ).toEqual([newest]);
  });
});
