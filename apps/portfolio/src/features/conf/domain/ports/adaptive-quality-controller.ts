import type { Milliseconds } from '@frozik/utils/date/types';

import type { IConnectionStats, TQualityTier } from '../adaptive-quality';

export interface IAdaptiveQualityController {
  readonly currentTier: TQualityTier;
  onTierChange(listener: (tier: TQualityTier) => void): VoidFunction;
  onStatsSample(listener: (stats: IConnectionStats) => void): VoidFunction;
  /** Idempotent. */
  dispose(): void;
}

export interface IAdaptiveQualityControllerParams {
  readonly peerConnection: RTCPeerConnection;
  readonly videoSender: RTCRtpSender;
  readonly pollIntervalMs?: Milliseconds;
}
