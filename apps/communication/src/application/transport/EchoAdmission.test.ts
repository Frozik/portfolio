import { assert } from '@frozik/utils/assert/assert';
import { describe, expect, it } from 'vitest';

import { EchoAdmission } from './EchoAdmission';

const HOUR_MS = 60 * 60 * 1000;
const QUOTA = { concurrentPerIp: 2, concurrentTotal: 3, bytesPerIpPerHour: 1000 } as const;

function admission() {
  const clock = { now: 0 };
  return { gate: new EchoAdmission(QUOTA, () => clock.now), clock };
}

describe('echo admission', () => {
  it('limits concurrent echoes per IP and frees the slot on release', () => {
    const { gate } = admission();
    const first = gate.admit('a', 1);
    assert(first.ok);
    expect(gate.admit('a', 1).ok).toBe(true);
    expect(gate.admit('a', 1)).toEqual({ ok: false, error: 'too-many-concurrent' });

    first.value.release();
    first.value.release();

    expect(gate.admit('a', 1).ok).toBe(true);
    expect(gate.admit('a', 1)).toEqual({ ok: false, error: 'too-many-concurrent' });
  });

  it('caps the whole server whatever the addresses', () => {
    const { gate } = admission();
    gate.admit('a', 1);
    gate.admit('b', 1);
    gate.admit('c', 1);
    expect(gate.admit('d', 1)).toEqual({ ok: false, error: 'server-busy' });
  });

  it('counts declared bytes against the IP for an hour, then forgets them', () => {
    const { gate, clock } = admission();
    const big = gate.admit('a', 800);
    assert(big.ok);
    big.value.release();

    expect(gate.admit('a', 300)).toEqual({ ok: false, error: 'hourly-quota' });
    expect(gate.admit('b', 300).ok).toBe(true);

    clock.now = HOUR_MS;
    expect(gate.admit('a', 300).ok).toBe(true);
  });

  it('holds calls from an unknown address only to the server-wide cap', () => {
    const { gate } = admission();
    expect(gate.admit(undefined, 900).ok).toBe(true);
    expect(gate.admit(undefined, 900).ok).toBe(true);
    expect(gate.admit(undefined, 900).ok).toBe(true);
    expect(gate.admit(undefined, 1)).toEqual({ ok: false, error: 'server-busy' });
  });
});
