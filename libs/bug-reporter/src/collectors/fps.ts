import type { IFpsSummary } from '../core/report';

const MAX_SAMPLES = 1_200;
const P95 = 0.95;
const DROPPED_FRAME_FACTOR = 1.5;

/**
 * Frame intervals while a recording runs — only then, because a permanent
 * animation-frame loop would itself cost the battery the report is about.
 */
export class FpsSampler {
  private readonly deltas = new Float32Array(MAX_SAMPLES);
  private count = 0;
  private lastFrameAt: number | null = null;
  private frameHandle: number | null = null;

  start(): void {
    if (this.frameHandle !== null) {
      return;
    }
    this.count = 0;
    this.lastFrameAt = null;
    this.frameHandle = requestAnimationFrame(this.onFrame);
  }

  stop(): IFpsSummary | null {
    if (this.frameHandle !== null) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
    return this.summary();
  }

  private readonly onFrame = (time: number): void => {
    if (this.lastFrameAt !== null) {
      this.deltas[this.count % MAX_SAMPLES] = time - this.lastFrameAt;
      this.count += 1;
    }
    this.lastFrameAt = time;
    this.frameHandle = requestAnimationFrame(this.onFrame);
  };

  private summary(): IFpsSummary | null {
    const frames = Math.min(this.count, MAX_SAMPLES);
    if (frames === 0) {
      return null;
    }
    const sorted = [...this.deltas.subarray(0, frames)].sort((left, right) => left - right);
    const medianMs = sorted[Math.floor(frames / 2)] ?? 0;
    const p95Ms = sorted[Math.min(frames - 1, Math.floor(frames * P95))] ?? 0;
    const worstMs = sorted[frames - 1] ?? 0;
    const droppedFrames = sorted.filter(delta => delta > medianMs * DROPPED_FRAME_FACTOR).length;
    return { frames, medianMs, p95Ms, worstMs, droppedFrames };
  }
}
