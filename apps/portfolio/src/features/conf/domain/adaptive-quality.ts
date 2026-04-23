import type { Milliseconds } from '@frozik/utils';

/**
 * Discrete quality tiers applied to the outbound video sender. Keeping
 * the tier set small (3 steps) avoids oscillation on the boundary of
 * two neighbouring tiers when network stats hover around a threshold.
 */
export type TQualityTier = 'high' | 'medium' | 'low';

/**
 * Per-tier parameters baked into `RTCRtpSender.setParameters({ encodings })`
 * whenever a tier change is applied. `scaleResolutionDownBy` multiplies
 * the source resolution: 1.0 = native, 1.5 = 66% of each axis, 2.0 = 50%.
 * All values were tuned against a 640×480 capture at 30 FPS on broadband
 * uplinks of ~5 Mbps and below; adjust together when the capture
 * pipeline resolution changes.
 */
export interface IQualityTierParams {
  readonly maxBitrate: number;
  readonly maxFramerate: number;
  readonly scaleResolutionDownBy: number;
}

export const QUALITY_TIER_PARAMS: Readonly<Record<TQualityTier, IQualityTierParams>> = {
  high: { maxBitrate: 1_500_000, maxFramerate: 30, scaleResolutionDownBy: 1 },
  medium: { maxBitrate: 600_000, maxFramerate: 24, scaleResolutionDownBy: 1.5 },
  low: { maxBitrate: 250_000, maxFramerate: 15, scaleResolutionDownBy: 2 },
};

/** Ordered from best to worst for step-wise tier transitions. */
export const QUALITY_TIER_ORDER: readonly TQualityTier[] = ['high', 'medium', 'low'];

/**
 * A single poll sample from `RTCPeerConnection.getStats()` normalised
 * into the shape the tier selector cares about. Deltas are computed by
 * the infrastructure layer from consecutive raw `outbound-rtp` reports
 * so this domain-level function stays pure.
 */
export interface IConnectionStats {
  /** Round-trip time to the remote peer in ms; `null` when unknown. */
  readonly rttMs: number | null;
  /** Packet loss as a 0..1 fraction over the last poll window; `null` if insufficient traffic. */
  readonly packetLossFraction: number | null;
  /** Browser-estimated outgoing bitrate in bits/sec (Chrome-only field); `null` elsewhere. */
  readonly availableOutgoingBitrate: number | null;
}

/**
 * Opaque state carried by the infrastructure controller between polls.
 * All timestamps are `performance.now()` milliseconds.
 */
export interface IAdaptiveQualityState {
  readonly currentTier: TQualityTier;
  readonly lastTierChangeAt: Milliseconds;
  /** When the stats were last classified as "good"; `null` if the current window is not good. */
  readonly goodStateSince: Milliseconds | null;
}

/** Debounce: minimum time between any two tier changes, in either direction. */
export const MIN_MS_BETWEEN_TIER_CHANGES = 7_000 as Milliseconds;

/** Upgrades additionally require stats to be good for at least this long before we try. */
export const UPGRADE_COOLDOWN_MS = 10_000 as Milliseconds;

/**
 * Boundary thresholds with an asymmetric "dead zone" between good and
 * bad so readings right on the boundary don't toggle the tier. Values
 * in between good and bad are treated as "mediocre" — neither trigger
 * an upgrade nor a downgrade.
 */
export const RTT_GOOD_MAX_MS = 150 as Milliseconds;
export const RTT_BAD_MIN_MS = 300 as Milliseconds;
export const LOSS_GOOD_MAX_FRACTION = 0.02;
export const LOSS_BAD_MIN_FRACTION = 0.05;

type TClassification = 'good' | 'mediocre' | 'bad';

function classifyStats(stats: IConnectionStats): TClassification {
  const rtt = stats.rttMs;
  const loss = stats.packetLossFraction;

  const rttIsBad = rtt !== null && rtt >= RTT_BAD_MIN_MS;
  const lossIsBad = loss !== null && loss >= LOSS_BAD_MIN_FRACTION;
  if (rttIsBad || lossIsBad) {
    return 'bad';
  }

  const rttIsGood = rtt === null ? true : rtt < RTT_GOOD_MAX_MS;
  const lossIsGood = loss === null ? true : loss < LOSS_GOOD_MAX_FRACTION;
  if (rttIsGood && lossIsGood) {
    return 'good';
  }
  return 'mediocre';
}

function nextTierDown(current: TQualityTier): TQualityTier {
  switch (current) {
    case 'high':
      return 'medium';
    case 'medium':
      return 'low';
    case 'low':
      return 'low';
  }
}

function nextTierUp(current: TQualityTier): TQualityTier {
  switch (current) {
    case 'high':
      return 'high';
    case 'medium':
      return 'high';
    case 'low':
      return 'medium';
  }
}

/**
 * Pure state transition for the adaptive-quality state machine. Given
 * the last stored state, a fresh stats sample, and the current wall
 * clock, returns the new state.
 *
 * Rules:
 *  1. Downgrade one tier immediately when stats are classified `bad`,
 *     provided `MIN_MS_BETWEEN_TIER_CHANGES` has elapsed since the last
 *     change. No "sustained bad" requirement — users notice stalls fast,
 *     we react fast.
 *  2. Upgrade one tier only when stats have been continuously `good`
 *     for at least `UPGRADE_COOLDOWN_MS` AND the debounce window since
 *     the last change has elapsed. Rising slowly is less jarring than
 *     dropping slowly.
 *  3. `mediocre` stats hold the current tier and reset the good-since
 *     timer (so you cannot coast through a bad patch into an upgrade).
 *  4. Unknown stats (rtt/loss both null) classify as `good` because
 *     lack of feedback usually means low traffic + healthy path.
 *
 * The function never changes the tier more than one step per call —
 * stepping is deliberate, even when two successive polls both register
 * `bad`. Callers drive it on their own schedule.
 */
export function advanceAdaptiveQuality(
  state: IAdaptiveQualityState,
  stats: IConnectionStats,
  nowMs: Milliseconds
): IAdaptiveQualityState {
  const classification = classifyStats(stats);
  const msSinceChange = nowMs - state.lastTierChangeAt;

  if (classification === 'bad') {
    const canChange = msSinceChange >= MIN_MS_BETWEEN_TIER_CHANGES;
    const nextTier = nextTierDown(state.currentTier);
    if (!canChange || nextTier === state.currentTier) {
      return { ...state, goodStateSince: null };
    }
    return { currentTier: nextTier, lastTierChangeAt: nowMs, goodStateSince: null };
  }

  if (classification === 'mediocre') {
    return { ...state, goodStateSince: null };
  }

  // classification === 'good'
  const goodSince = state.goodStateSince ?? nowMs;
  const msInGood = nowMs - goodSince;
  const nextTier = nextTierUp(state.currentTier);
  const canUpgrade =
    msInGood >= UPGRADE_COOLDOWN_MS &&
    msSinceChange >= MIN_MS_BETWEEN_TIER_CHANGES &&
    nextTier !== state.currentTier;

  if (!canUpgrade) {
    return { ...state, goodStateSince: goodSince as Milliseconds };
  }
  return { currentTier: nextTier, lastTierChangeAt: nowMs, goodStateSince: nowMs };
}

/** Factory for the initial state at the moment the call is established. */
export function createInitialAdaptiveQualityState(nowMs: Milliseconds): IAdaptiveQualityState {
  return {
    currentTier: 'high',
    lastTierChangeAt: nowMs,
    goodStateSince: nowMs,
  };
}
