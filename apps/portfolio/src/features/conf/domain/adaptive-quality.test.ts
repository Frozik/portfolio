import type { Milliseconds } from '@frozik/utils';
import { describe, expect, it } from 'vitest';
import type { IAdaptiveQualityState, IConnectionStats } from './adaptive-quality';
import {
  advanceAdaptiveQuality,
  createInitialAdaptiveQualityState,
  LOSS_BAD_MIN_FRACTION,
  LOSS_GOOD_MAX_FRACTION,
  MIN_MS_BETWEEN_TIER_CHANGES,
  RTT_BAD_MIN_MS,
  RTT_GOOD_MAX_MS,
  UPGRADE_COOLDOWN_MS,
} from './adaptive-quality';

const MS_EPSILON = 1 as Milliseconds;

function ms(value: number): Milliseconds {
  return value as Milliseconds;
}

function goodStats(): IConnectionStats {
  return {
    rttMs: RTT_GOOD_MAX_MS - MS_EPSILON,
    packetLossFraction: 0,
    availableOutgoingBitrate: 2_000_000,
  };
}

function badStats(): IConnectionStats {
  return {
    rttMs: RTT_BAD_MIN_MS + ms(100),
    packetLossFraction: LOSS_BAD_MIN_FRACTION + 0.02,
    availableOutgoingBitrate: 100_000,
  };
}

function mediocreStats(): IConnectionStats {
  return {
    rttMs: (RTT_GOOD_MAX_MS + RTT_BAD_MIN_MS) / 2,
    packetLossFraction: (LOSS_GOOD_MAX_FRACTION + LOSS_BAD_MIN_FRACTION) / 2,
    availableOutgoingBitrate: 700_000,
  };
}

describe('createInitialAdaptiveQualityState', () => {
  it('starts at "high" with good-state timer armed', () => {
    const state = createInitialAdaptiveQualityState(ms(1_000));
    expect(state.currentTier).toBe('high');
    expect(state.lastTierChangeAt).toBe(1_000);
    expect(state.goodStateSince).toBe(1_000);
  });
});

describe('advanceAdaptiveQuality — downgrade on bad stats', () => {
  it('downgrades one step when stats are bad and debounce has elapsed', () => {
    const initial = createInitialAdaptiveQualityState(ms(0));
    const next = advanceAdaptiveQuality(initial, badStats(), MIN_MS_BETWEEN_TIER_CHANGES);
    expect(next.currentTier).toBe('medium');
    expect(next.lastTierChangeAt).toBe(MIN_MS_BETWEEN_TIER_CHANGES);
    expect(next.goodStateSince).toBeNull();
  });

  it('holds the tier when bad but debounce has not elapsed', () => {
    const initial = createInitialAdaptiveQualityState(ms(0));
    const next = advanceAdaptiveQuality(initial, badStats(), ms(1_000));
    expect(next.currentTier).toBe('high');
    expect(next.lastTierChangeAt).toBe(0);
    expect(next.goodStateSince).toBeNull();
  });

  it('steps only one tier at a time across multiple bad polls', () => {
    let state: IAdaptiveQualityState = createInitialAdaptiveQualityState(ms(0));
    state = advanceAdaptiveQuality(state, badStats(), MIN_MS_BETWEEN_TIER_CHANGES);
    expect(state.currentTier).toBe('medium');
    state = advanceAdaptiveQuality(state, badStats(), ms(MIN_MS_BETWEEN_TIER_CHANGES * 2));
    expect(state.currentTier).toBe('low');
    state = advanceAdaptiveQuality(state, badStats(), ms(MIN_MS_BETWEEN_TIER_CHANGES * 3));
    expect(state.currentTier).toBe('low');
  });
});

describe('advanceAdaptiveQuality — upgrade on sustained good', () => {
  it('does not upgrade before the cooldown elapses', () => {
    const initial: IAdaptiveQualityState = {
      currentTier: 'low',
      lastTierChangeAt: ms(0),
      goodStateSince: ms(0),
    };
    const halfCooldown = ms(UPGRADE_COOLDOWN_MS / 2);
    const next = advanceAdaptiveQuality(initial, goodStats(), halfCooldown);
    expect(next.currentTier).toBe('low');
    expect(next.goodStateSince).toBe(0);
  });

  it('upgrades one step when good for longer than the cooldown AND debounce', () => {
    const initial: IAdaptiveQualityState = {
      currentTier: 'low',
      lastTierChangeAt: ms(0),
      goodStateSince: ms(0),
    };
    const after = ms(Math.max(UPGRADE_COOLDOWN_MS, MIN_MS_BETWEEN_TIER_CHANGES) + 1_000);
    const next = advanceAdaptiveQuality(initial, goodStats(), after);
    expect(next.currentTier).toBe('medium');
    expect(next.lastTierChangeAt).toBe(after);
    expect(next.goodStateSince).toBe(after);
  });

  it('does not climb above "high"', () => {
    const initial: IAdaptiveQualityState = {
      currentTier: 'high',
      lastTierChangeAt: ms(0),
      goodStateSince: ms(0),
    };
    const after = ms(Math.max(UPGRADE_COOLDOWN_MS, MIN_MS_BETWEEN_TIER_CHANGES) + 1_000);
    const next = advanceAdaptiveQuality(initial, goodStats(), after);
    expect(next.currentTier).toBe('high');
  });
});

describe('advanceAdaptiveQuality — mediocre stats', () => {
  it('holds the tier and resets the good-since timer', () => {
    const initial: IAdaptiveQualityState = {
      currentTier: 'medium',
      lastTierChangeAt: ms(0),
      goodStateSince: ms(100),
    };
    const next = advanceAdaptiveQuality(initial, mediocreStats(), ms(5_000));
    expect(next.currentTier).toBe('medium');
    expect(next.goodStateSince).toBeNull();
  });

  it('prevents coasting through mediocre into an upgrade', () => {
    let state: IAdaptiveQualityState = {
      currentTier: 'low',
      lastTierChangeAt: ms(0),
      goodStateSince: ms(0),
    };
    // Nine seconds of good, then one second of mediocre, then one second of good.
    state = advanceAdaptiveQuality(state, goodStats(), ms(9_000));
    state = advanceAdaptiveQuality(state, mediocreStats(), ms(10_000));
    state = advanceAdaptiveQuality(state, goodStats(), ms(11_000));
    expect(state.currentTier).toBe('low');
    expect(state.goodStateSince).toBe(11_000);
  });
});

describe('advanceAdaptiveQuality — unknown stats', () => {
  it('treats null rtt + null loss as good (quiet/healthy)', () => {
    const initial: IAdaptiveQualityState = {
      currentTier: 'low',
      lastTierChangeAt: ms(0),
      goodStateSince: ms(0),
    };
    const quietStats: IConnectionStats = {
      rttMs: null,
      packetLossFraction: null,
      availableOutgoingBitrate: null,
    };
    const after = ms(Math.max(UPGRADE_COOLDOWN_MS, MIN_MS_BETWEEN_TIER_CHANGES) + 1_000);
    const next = advanceAdaptiveQuality(initial, quietStats, after);
    expect(next.currentTier).toBe('medium');
  });
});
