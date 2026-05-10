import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenClaims } from '../domain/Identity';
import type { Milliseconds, UserId } from '../domain/types';
import { TokenLifecycle } from './TokenLifecycle';

const NOW_MS = 1_700_000_000_000;
const EXPIRY_MS = NOW_MS + 3_600_000; // +1 hour
const WARNING_SECONDS = 60;
const USER_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' as UserId;

function makeClaims(overrides: Partial<TokenClaims> = {}): TokenClaims {
  return {
    sub: USER_ID,
    provider: 'google',
    iat: NOW_MS as Milliseconds,
    exp: EXPIRY_MS as Milliseconds,
    name: 'Alice',
    ...overrides,
  };
}

describe('TokenLifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW_MS));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('arms warning at exp - warningSeconds and expiry at exp', () => {
    const lifecycle = new TokenLifecycle({ warningSeconds: WARNING_SECONDS });
    const onWarning = vi.fn();
    const onExpired = vi.fn();
    lifecycle.arm(makeClaims(), { onWarning, onExpired });

    // Just before warning point.
    vi.advanceTimersByTime(EXPIRY_MS - WARNING_SECONDS * 1_000 - NOW_MS - 1);
    expect(onWarning).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();

    // Cross the warning point.
    vi.advanceTimersByTime(2);
    expect(onWarning).toHaveBeenCalledWith(WARNING_SECONDS);
    expect(onExpired).not.toHaveBeenCalled();

    // Cross the expiry point.
    vi.advanceTimersByTime(WARNING_SECONDS * 1_000);
    expect(onExpired).toHaveBeenCalledTimes(1);

    lifecycle.dispose();
  });

  it('replaceClaims cancels the old warning so it never fires', () => {
    const lifecycle = new TokenLifecycle({ warningSeconds: WARNING_SECONDS });
    const oldOnWarning = vi.fn();
    const oldOnExpired = vi.fn();
    lifecycle.arm(makeClaims(), { onWarning: oldOnWarning, onExpired: oldOnExpired });

    // Replace before either fires.
    vi.advanceTimersByTime(1_000);
    const newOnWarning = vi.fn();
    const newOnExpired = vi.fn();
    const newExpiryMs = NOW_MS + 7_200_000; // +2h
    vi.setSystemTime(new Date(NOW_MS + 1_000));
    lifecycle.replaceClaims(makeClaims({ exp: newExpiryMs as Milliseconds }), {
      onWarning: newOnWarning,
      onExpired: newOnExpired,
    });

    // Advance well past where the OLD warning would have fired.
    vi.advanceTimersByTime(EXPIRY_MS - NOW_MS);
    expect(oldOnWarning).not.toHaveBeenCalled();
    expect(oldOnExpired).not.toHaveBeenCalled();

    // The new warning fires at its own schedule.
    vi.advanceTimersByTime(
      newExpiryMs - WARNING_SECONDS * 1_000 - (NOW_MS + 1_000) - (EXPIRY_MS - NOW_MS) + 5
    );
    expect(newOnWarning).toHaveBeenCalledTimes(1);

    lifecycle.dispose();
  });

  it('disarm prevents callbacks from firing', () => {
    const lifecycle = new TokenLifecycle({ warningSeconds: WARNING_SECONDS });
    const onWarning = vi.fn();
    const onExpired = vi.fn();
    lifecycle.arm(makeClaims(), { onWarning, onExpired });
    lifecycle.disarm();
    vi.advanceTimersByTime(EXPIRY_MS - NOW_MS + 10_000);
    expect(onWarning).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('handles long-TTL claims (Yandex JWTs are valid for ~1 year) without firing immediately', () => {
    // Yandex' `/info?format=jwt` issues JWTs with year-long TTLs. The
    // unguarded `setTimeout(callback, expMs - nowMs)` would clamp such
    // a delay to 1 ms (it overflows int32) and fire `onExpired`
    // immediately — kicking the user out the moment they connect.
    const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1_000;
    const lifecycle = new TokenLifecycle({ warningSeconds: WARNING_SECONDS });
    const onWarning = vi.fn();
    const onExpired = vi.fn();
    lifecycle.arm(makeClaims({ exp: (NOW_MS + ONE_YEAR_MS) as Milliseconds }), {
      onWarning,
      onExpired,
    });

    // 30 days in: chained setTimeout has crossed the 24.8-day max
    // boundary at least once but no callback fired.
    vi.advanceTimersByTime(30 * 24 * 60 * 60 * 1_000);
    expect(onWarning).not.toHaveBeenCalled();
    expect(onExpired).not.toHaveBeenCalled();

    // Step past the warning point (year minus 60s).
    vi.advanceTimersByTime(ONE_YEAR_MS - 30 * 24 * 60 * 60 * 1_000 - WARNING_SECONDS * 1_000);
    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(onWarning).toHaveBeenCalledWith(WARNING_SECONDS);
    expect(onExpired).not.toHaveBeenCalled();

    // Cross the expiry point.
    vi.advanceTimersByTime(WARNING_SECONDS * 1_000);
    expect(onExpired).toHaveBeenCalledTimes(1);

    lifecycle.dispose();
  });
});
