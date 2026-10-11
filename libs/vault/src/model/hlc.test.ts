import * as fc from 'fast-check';

import type { IHlc } from './hlc';
import { compareHlc, hlcReceive, hlcTick, initialHlc, MAX_REMOTE_LEAD_MS, maxHlc } from './hlc';

const PROPERTY_SEED = 20261011;
const stamp = fc.record({
  wallMs: fc.integer({ min: 0, max: 2_000_000_000_000 }),
  counter: fc.nat(1000),
  node: fc.constantFrom('device-a:1', 'device-b:1', 'device-a:2'),
});

describe('hybrid logical clock', () => {
  it('orders by wall time, then counter, then node', () => {
    const base: IHlc = { wallMs: 10, counter: 0, node: 'b' };

    expect(compareHlc(base, { ...base, wallMs: 11 })).toBeLessThan(0);
    expect(compareHlc(base, { ...base, counter: 1 })).toBeLessThan(0);
    expect(compareHlc(base, { ...base, node: 'a' })).toBeGreaterThan(0);
    expect(compareHlc(base, { ...base })).toBe(0);
    expect(maxHlc(base, { ...base, counter: 3 })).toEqual({ ...base, counter: 3 });
  });

  it('ticks strictly forward, even when the wall clock goes back', () => {
    fc.assert(
      fc.property(stamp, fc.integer({ min: 0, max: 2_000_000_000_000 }), (last, wallMs) => {
        const next = hlcTick(last, wallMs);
        return compareHlc(next, last) > 0 && next.node === last.node && next.wallMs >= wallMs;
      }),
      { seed: PROPERTY_SEED }
    );
  });

  it('moves past a received stamp and keeps its own node', () => {
    fc.assert(
      fc.property(
        stamp,
        stamp,
        fc.integer({ min: 0, max: 2_000_000_000_000 }),
        (last, remote, wallMs) => {
          fc.pre(remote.wallMs <= wallMs + MAX_REMOTE_LEAD_MS);
          const { clock, remoteAhead } = hlcReceive(last, remote, wallMs);
          return (
            !remoteAhead &&
            compareHlc(clock, last) > 0 &&
            (clock.wallMs > remote.wallMs || clock.counter > remote.counter) &&
            clock.node === last.node
          );
        }
      ),
      { seed: PROPERTY_SEED }
    );
  });

  it('does not follow a device whose clock runs more than a day ahead, and says so', () => {
    const last = initialHlc('me:1');
    const now = 1_760_000_000_000;
    const runaway: IHlc = { wallMs: now + MAX_REMOTE_LEAD_MS + 1, counter: 0, node: 'other:1' };

    expect(hlcReceive(last, runaway, now)).toEqual({ clock: last, remoteAhead: true });
  });
});
