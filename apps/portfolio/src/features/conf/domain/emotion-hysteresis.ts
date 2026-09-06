import type { TEmotion } from './emotion';

/**
 * Hysteresis for the emotion label so it does not flicker on every detection:
 * a new classification must appear on this many consecutive detections before
 * it replaces the committed emotion. At a ~30 Hz cadence two consecutive
 * detections are ≈ 66 ms — imperceptible latency.
 */
const COMMIT_THRESHOLD = 2;

export class EmotionHysteresis {
  private committed: TEmotion = 'neutral';
  private candidate: TEmotion | undefined = undefined;
  private candidateCount = 0;

  get current(): TEmotion {
    return this.committed;
  }

  /** Feeds one detection; answers the newly committed emotion, or nothing while it holds. */
  observe(next: TEmotion): TEmotion | undefined {
    if (next === this.committed) {
      this.candidate = undefined;
      this.candidateCount = 0;
      return undefined;
    }
    if (this.candidate === next) {
      this.candidateCount += 1;
    } else {
      this.candidate = next;
      this.candidateCount = 1;
    }
    if (this.candidateCount < COMMIT_THRESHOLD) {
      return undefined;
    }
    this.committed = next;
    this.candidate = undefined;
    this.candidateCount = 0;
    return this.committed;
  }
}
