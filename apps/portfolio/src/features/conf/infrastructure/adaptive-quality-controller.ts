import type { Milliseconds } from '@frozik/utils/date/types';
import { isNil } from 'lodash-es';

import type {
  IAdaptiveQualityState,
  IConnectionStats,
  TQualityTier,
} from '../domain/adaptive-quality';
import {
  advanceAdaptiveQuality,
  createInitialAdaptiveQualityState,
  QUALITY_TIER_PARAMS,
} from '../domain/adaptive-quality';
import type {
  IAdaptiveQualityController,
  IAdaptiveQualityControllerParams,
} from '../domain/ports/adaptive-quality-controller';

const DEFAULT_POLL_INTERVAL_MS = 2_500 as Milliseconds;
const SECONDS_TO_MS = 1_000;

interface IPreviousOutboundCounters {
  readonly packetsSent: number;
  readonly packetsLost: number;
}

interface IRawPollInputs {
  readonly outboundPacketsSent: number | undefined;
  readonly remoteInboundPacketsLost: number | undefined;
  readonly rttSeconds: number | undefined;
  readonly availableOutgoingBitrate: number | undefined;
}

interface IStatsEntry {
  readonly type: string;
  readonly kind?: string;
  readonly packetsSent?: number;
  readonly packetsLost?: number;
  readonly roundTripTime?: number;
  readonly currentRoundTripTime?: number;
  readonly availableOutgoingBitrate?: number;
  readonly nominated?: boolean;
  readonly state?: string;
}

function extractPollInputs(report: RTCStatsReport): IRawPollInputs {
  let outboundPacketsSent: number | undefined;
  let remoteInboundPacketsLost: number | undefined;
  let rttSeconds: number | undefined;
  let availableOutgoingBitrate: number | undefined;

  report.forEach(rawEntry => {
    const entry = rawEntry as IStatsEntry;
    const { type, kind } = entry;

    if (type === 'outbound-rtp' && kind === 'video') {
      if (!isNil(entry.packetsSent)) {
        outboundPacketsSent = entry.packetsSent;
      }
      return;
    }

    if (type === 'remote-inbound-rtp' && kind === 'video') {
      if (!isNil(entry.packetsLost)) {
        remoteInboundPacketsLost = entry.packetsLost;
      }
      if (!isNil(entry.roundTripTime)) {
        rttSeconds = entry.roundTripTime;
      }
      return;
    }

    if (type === 'candidate-pair') {
      const isSelected = entry.nominated === true && entry.state === 'succeeded';
      if (isSelected && !isNil(entry.currentRoundTripTime)) {
        rttSeconds = entry.currentRoundTripTime;
      }
      // `availableOutgoingBitrate` lives on candidate-pair, not outbound-rtp.
      if (isSelected && !isNil(entry.availableOutgoingBitrate)) {
        availableOutgoingBitrate = entry.availableOutgoingBitrate;
      }
      return;
    }
  });

  return {
    outboundPacketsSent,
    remoteInboundPacketsLost,
    rttSeconds,
    availableOutgoingBitrate,
  };
}

function computeLossFraction(
  current: IRawPollInputs,
  previous: IPreviousOutboundCounters | undefined
): number | undefined {
  if (
    previous === undefined ||
    current.outboundPacketsSent === undefined ||
    current.remoteInboundPacketsLost === undefined
  ) {
    return undefined;
  }
  const deltaSent = current.outboundPacketsSent - previous.packetsSent;
  const deltaLost = current.remoteInboundPacketsLost - previous.packetsLost;
  if (deltaSent <= 0) {
    return undefined;
  }
  const total = deltaSent + Math.max(0, deltaLost);
  if (total <= 0) {
    return 0;
  }
  return Math.max(0, deltaLost) / total;
}

async function applyTier(sender: RTCRtpSender, tier: TQualityTier): Promise<void> {
  const parameters = sender.getParameters();
  const nextEncodings: RTCRtpEncodingParameters[] =
    parameters.encodings.length === 0
      ? [{}]
      : parameters.encodings.map(existing => ({ ...existing }));
  const primary = nextEncodings[0];
  if (isNil(primary)) {
    return;
  }
  const tierParams = QUALITY_TIER_PARAMS[tier];
  primary.maxBitrate = tierParams.maxBitrate;
  primary.maxFramerate = tierParams.maxFramerate;
  primary.scaleResolutionDownBy = tierParams.scaleResolutionDownBy;
  nextEncodings[0] = primary;
  await sender.setParameters({ ...parameters, encodings: nextEncodings });
}

/**
 * Polls `RTCPeerConnection.getStats()` at a fixed cadence, folds each
 * poll into the pure `advanceAdaptiveQuality` state machine, and
 * applies tier changes by calling `RTCRtpSender.setParameters()` on the
 * outbound video sender.
 *
 * Stats extraction:
 *  - `outbound-rtp` (kind: video) supplies the `packetsSent` cumulative
 *    counter.
 *  - `remote-inbound-rtp` (kind: video) — paired report from the remote
 *    peer — supplies `packetsLost` cumulative counter and a per-stream
 *    `roundTripTime`.
 *  - `candidate-pair` with `nominated: true, state: 'succeeded'`
 *    supplies `currentRoundTripTime` as a fallback RTT source for the
 *    first polls before remote-inbound arrives, plus Chrome's
 *    `availableOutgoingBitrate` bandwidth estimate.
 *
 * Packet loss is a fraction over the last poll window, derived from
 * deltas of cumulative counters; the first poll always yields `undefined`
 * loss (no baseline) which the domain layer treats as "good" (healthy
 * quiet path).
 */
export function createAdaptiveQualityController(
  params: IAdaptiveQualityControllerParams
): IAdaptiveQualityController {
  const { peerConnection, videoSender } = params;
  const pollIntervalMs = params.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  const tierListeners = new Set<(tier: TQualityTier) => void>();
  const statsListeners = new Set<(stats: IConnectionStats) => void>();
  let state: IAdaptiveQualityState = createInitialAdaptiveQualityState(
    performance.now() as Milliseconds
  );
  let previousCounters: IPreviousOutboundCounters | undefined;
  let pollHandle: ReturnType<typeof setTimeout> | undefined;
  let isDisposed = false;

  // A sender rejects `setParameters` before negotiation completes; the first poll reapplies the tier.
  void applyTier(videoSender, state.currentTier).catch(() => undefined);

  function notifyTier(tier: TQualityTier): void {
    tierListeners.forEach(listener => listener(tier));
  }

  function notifyStats(stats: IConnectionStats): void {
    statsListeners.forEach(listener => listener(stats));
  }

  async function pollOnce(): Promise<void> {
    if (isDisposed) {
      return;
    }
    // `getStats` rejects once the peer closed between scheduling and running.
    const report = await peerConnection.getStats(videoSender.track).catch(() => undefined);
    if (isNil(report) || isDisposed) {
      return;
    }
    const raw = extractPollInputs(report);
    const packetLossFraction = computeLossFraction(raw, previousCounters);
    const stats: IConnectionStats = {
      rttMs: raw.rttSeconds === undefined ? undefined : raw.rttSeconds * SECONDS_TO_MS,
      packetLossFraction,
      availableOutgoingBitrate: raw.availableOutgoingBitrate,
    };
    if (raw.outboundPacketsSent !== undefined && raw.remoteInboundPacketsLost !== undefined) {
      previousCounters = {
        packetsSent: raw.outboundPacketsSent,
        packetsLost: raw.remoteInboundPacketsLost,
      };
    }
    notifyStats(stats);
    const nextState = advanceAdaptiveQuality(state, stats, performance.now() as Milliseconds);
    if (nextState.currentTier !== state.currentTier) {
      // A rejected `setParameters` (renegotiation in flight, peer closing) keeps the old tier; the next poll retries.
      const applied = await applyTier(videoSender, nextState.currentTier).then(
        () => true,
        () => false
      );
      if (!applied || isDisposed) {
        return;
      }
      state = nextState;
      notifyTier(state.currentTier);
      return;
    }
    state = nextState;
  }

  function schedulePoll(): void {
    if (isDisposed) {
      return;
    }
    pollHandle = setTimeout(() => {
      pollHandle = undefined;
      void pollOnce().finally(schedulePoll);
    }, pollIntervalMs);
  }

  schedulePoll();

  function dispose(): void {
    if (isDisposed) {
      return;
    }
    isDisposed = true;
    if (!isNil(pollHandle)) {
      clearTimeout(pollHandle);
      pollHandle = undefined;
    }
    tierListeners.clear();
    statsListeners.clear();
  }

  return {
    get currentTier() {
      return state.currentTier;
    },
    onTierChange(listener) {
      tierListeners.add(listener);
      return () => {
        tierListeners.delete(listener);
      };
    },
    onStatsSample(listener) {
      statsListeners.add(listener);
      return () => {
        statsListeners.delete(listener);
      };
    },
    dispose,
  };
}
