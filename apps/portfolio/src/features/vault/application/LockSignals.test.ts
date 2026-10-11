import type { Milliseconds } from '@frozik/utils/date/types';

import type { ILockTimeouts } from '../domain/lock-deadline';
import { DEFAULT_LOCK_TIMEOUTS, LOCK_CHECK_INTERVAL_MS } from '../domain/lock-deadline';
import { createFakePageSignals } from './fake-page-signals.test-helper';
import { createFakeSessionClock } from './fake-session-clock.test-helper';
import type { TPageLock } from './LockSignals';
import { LockSignals } from './LockSignals';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

function fakePage(hidden = false) {
  const time = createFakeSessionClock();
  const signals = createFakePageSignals(hidden);
  return {
    ...time,
    ...signals,
    subscribers: () => signals.subscribers() + time.pendingTimers(),
  };
}

function watch(fake: ReturnType<typeof fakePage>, timeouts: ILockTimeouts = DEFAULT_LOCK_TIMEOUTS) {
  const locks: TPageLock[] = [];
  const signals = new LockSignals(fake.page, fake.clock, timeouts, reason => locks.push(reason));
  return { locks, signals };
}

describe('LockSignals', () => {
  it('locks after five idle minutes, and activity pushes the deadline back', () => {
    const fake = fakePage();
    const { locks } = watch(fake);

    fake.advance(4 * MINUTE);
    fake.act();
    fake.advance(4 * MINUTE);
    expect(locks).toEqual([]);

    fake.advance(MINUTE + LOCK_CHECK_INTERVAL_MS);
    expect(locks).toEqual(['idle']);
  });

  it('locks a tab hidden for a minute, before the idle timeout', () => {
    const fake = fakePage();
    const { locks } = watch(fake);

    fake.setHidden(true);
    fake.advance(MINUTE + LOCK_CHECK_INTERVAL_MS);

    expect(locks).toEqual(['hidden']);
  });

  it('locks on return when the hidden deadline passed while timers were throttled', () => {
    const fake = fakePage();
    const { locks } = watch(fake);

    fake.setHidden(true);
    fake.sleep(2 * MINUTE);
    fake.setHidden(false);

    expect(locks).toEqual(['hidden']);
  });

  it('locks a hidden tab at once when set to "immediately", and never when set to "never"', () => {
    const immediate = fakePage();
    const atOnce = watch(immediate, { ...DEFAULT_LOCK_TIMEOUTS, hidden: 0 as Milliseconds });
    immediate.setHidden(true);

    const never = fakePage();
    const kept = watch(never, { idle: (60 * MINUTE) as Milliseconds, hidden: null });
    never.setHidden(true);
    never.advance(30 * MINUTE);

    expect(atOnce.locks).toEqual(['hidden']);
    expect(kept.locks).toEqual([]);
  });

  it('reports a sleep that outlasted the idle deadline, and ignores a short one', () => {
    const short = fakePage();
    const nap = watch(short);
    short.sleep(2 * MINUTE);
    short.advance(LOCK_CHECK_INTERVAL_MS);

    const long = fakePage();
    const night = watch(long);
    long.sleep(8 * 60 * MINUTE);
    long.advance(LOCK_CHECK_INTERVAL_MS);

    expect(nap.locks).toEqual([]);
    expect(night.locks).toEqual(['sleep']);
  });

  it('locks when the page is left and when it comes back from the back/forward cache', () => {
    const leaving = fakePage();
    const left = watch(leaving);
    leaving.hide();

    const returning = fakePage();
    const restored = watch(returning);
    returning.restore();

    expect(left.locks).toEqual(['pagehide']);
    expect(restored.locks).toEqual(['bfcache']);
  });

  it('asks to lock once and lets go of the page', () => {
    const fake = fakePage();
    const { locks } = watch(fake);

    fake.hide();
    fake.restore();
    fake.advance(10 * MINUTE);

    expect(locks).toEqual(['pagehide']);
    expect(fake.subscribers()).toBe(0);
  });
});
