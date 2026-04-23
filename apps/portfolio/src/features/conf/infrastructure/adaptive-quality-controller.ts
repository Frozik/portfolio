import type { Milliseconds } from '@frozik/utils';
import { isNil } from 'lodash-es';

import type { IAdaptiveQualityState, IConnectionStats, TQualityTier } from '../domain';
import {
  advanceAdaptiveQuality,
  createInitialAdaptiveQualityState,
  QUALITY_TIER_PARAMS,
} from '../domain';

export interface IAdaptiveQualityController {
  readonly currentTier: TQualityTier;
  onTierChange(listener: (tier: TQualityTier) => void): () => void;
  onStatsSample(listener: (stats: IConnectionStats) => void): () => void;
  dispose(): void;
}

export interface IAdaptiveQualityControllerParams {
  readonly peerConnection: RTCPeerConnection;
  readonly videoSender: RTCRtpSender;
  readonly pollIntervalMs?: Milliseconds;
}

const DEFAULT_POLL_INTERVAL_MS = 2_500 as Milliseconds;
const SECONDS_TO_MS = 1_000;

interface IPreviousOutboundCounters {
  readonly packetsSent: number;
  readonly packetsLost: number;
}

interface IRawPollInputs {
  readonly outboundPacketsSent: number | null;
  readonly remoteInboundPacketsLost: number | null;
  readonly rttSeconds: number | null;
  readonly availableOutgoingBitrate: number | null;
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
  let outboundPacketsSent: number | null = null;
  let remoteInboundPacketsLost: number | null = null;
  let rttSeconds: number | null = null;
  let availableOutgoingBitrate: number | null = null;

  report.forEach(rawEntry => {
    const entry = rawEntry as IStatsEntry;
    const { type, kind } = entry;

    if (type === 'outbound-rtp' && kind === 'video') {
      if (!isNil(entry.packetsSent)) {
        outboundPacketsSent = entry.packetsSent;
      }
      if (!isNil(entry.availableOutgoingBitrate)) {
        availableOutgoingBitrate = entry.availableOutgoingBitrate;
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
  previous: IPreviousOutboundCounters | null
): number | null {
  if (
    previous === null ||
    current.outboundPacketsSent === null ||
    current.remoteInboundPacketsLost === null
  ) {
    return null;
  }
  const deltaSent = current.outboundPacketsSent - previous.packetsSent;
  const deltaLost = current.remoteInboundPacketsLost - previous.packetsLost;
  if (deltaSent <= 0) {
    return null;
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
 *  - `outbound-rtp` (kind: video) supplies `packetsSent` cumulative
 *    counter and Chrome's `availableOutgoingBitrate` estimate.
 *  - `remote-inbound-rtp` (kind: video) — paired report from the remote
 *    peer — supplies `packetsLost` cumulative counter and a per-stream
 *    `roundTripTime`.
 *  - `candidate-pair` with `nominated: true, state: 'succeeded'`
 *    supplies `currentRoundTripTime` as a fallback RTT source for the
 *    first polls before remote-inbound arrives.
 *
 * Packet loss is a fraction over the last poll window, derived from
 * deltas of cumulative counters; the first poll always yields `null`
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
  let previousCounters: IPreviousOutboundCounters | null = null;
  let pollHandle: ReturnType<typeof setTimeout> | null = null;
  let isDisposed = false;

  // Apply the initial tier up front so the encoder respects our cap
  // from the first frame, even before the first poll arrives.
  void applyTier(videoSender, state.currentTier).catch(() => {
    // Pre-negotiation senders reject setParameters; the next poll retries.
  });

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
    let report: RTCStatsReport;
    try {
      report = await peerConnection.getStats(videoSender.track);
    } catch {
      // The peer may have closed between scheduling and running; bail.
      return;
    }
    if (isDisposed) {
      return;
    }
    const raw = extractPollInputs(report);
    const packetLossFraction = computeLossFraction(raw, previousCounters);
    const stats: IConnectionStats = {
      rttMs: raw.rttSeconds === null ? null : raw.rttSeconds * SECONDS_TO_MS,
      packetLossFraction,
      availableOutgoingBitrate: raw.availableOutgoingBitrate,
    };
    if (raw.outboundPacketsSent !== null && raw.remoteInboundPacketsLost !== null) {
      previousCounters = {
        packetsSent: raw.outboundPacketsSent,
        packetsLost: raw.remoteInboundPacketsLost,
      };
    }
    notifyStats(stats);
    const nextState = advanceAdaptiveQuality(state, stats, performance.now() as Milliseconds);
    if (nextState.currentTier !== state.currentTier) {
      try {
        await applyTier(videoSender, nextState.currentTier);
      } catch {
        // If the sender rejects (renegotiation in flight, peer closing),
        // skip this transition — the next poll reattempts.
        return;
      }
      if (isDisposed) {
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
      pollHandle = null;
      void pollOnce().finally(schedulePoll);
    }, pollIntervalMs);
  }

  schedulePoll();

  function dispose(): void {
    if (isDisposed) {
      return;
    }
    isDisposed = true;
    if (pollHandle !== null) {
      clearTimeout(pollHandle);
      pollHandle = null;
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
