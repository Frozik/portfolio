import { isNil } from 'lodash-es';

import type { TEmotion } from '../domain/emotion';
import { classifyEmotion } from '../domain/emotion';
import { EmotionHysteresis } from '../domain/emotion-hysteresis';
import type { TGlassesStyle } from '../domain/glasses-style';
import { computeGlassesTransform } from '../domain/glasses-transform';
import type { IFaceLandmarkerClient } from './face-landmarker-client';
import type { GlassesImages } from './glasses-painter';
import { paintGlasses } from './glasses-painter';

export interface IArFramePipelineParams {
  readonly landmarker: IFaceLandmarkerClient;
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
  readonly glassesImages: GlassesImages;
  /** The style in effect right now; `none` means the pipeline is bypassed. */
  readonly readStyle: () => TGlassesStyle;
  readonly onEmotionChange: (emotion: TEmotion) => void;
}

/**
 * The AR pipeline: face detection on a snapshot of the live video, then the
 * SAME snapshot painted onto the output canvas with the glasses overlaid.
 * Locking video pixels and glasses to one snapshot is what keeps the overlay
 * rigidly attached — there is no chase between detection and display.
 *
 * The detector is single-flight. Snapshots taken while it is busy are
 * coalesced: the most recent unprocessed bitmap wins, older pending ones are
 * closed and discarded, and the freshest enters the pipeline the moment the
 * current detection resolves. Output framerate therefore matches the
 * detector's throughput (typically 30 Hz on GPU) at the cost of ~10–30 ms of
 * latency against the live camera — imperceptible on a call, indispensable
 * for the glasses lock.
 */
export class ArFramePipeline {
  private readonly params: IArFramePipelineParams;
  private readonly emotion = new EmotionHysteresis();
  private isProcessing = false;
  private pendingBitmap: ImageBitmap | undefined;
  private pendingTimestamp = 0;
  private isDisposed = false;

  constructor(params: IArFramePipelineParams) {
    this.params = params;
  }

  get currentEmotion(): TEmotion {
    return this.emotion.current;
  }

  /** Snapshots the source and queues it; while busy the newest snapshot replaces any pending one. */
  async capture(source: HTMLVideoElement, timestamp: number): Promise<void> {
    // `createImageBitmap` rejects while the source has no decoded frame yet; the next tick retries.
    const bitmap = await createImageBitmap(source).catch(() => undefined);
    if (isNil(bitmap)) {
      return;
    }
    if (this.isDisposed || this.params.readStyle() === 'none') {
      bitmap.close();
      return;
    }
    if (this.isProcessing) {
      this.dropPending();
      this.pendingBitmap = bitmap;
      this.pendingTimestamp = timestamp;
      return;
    }
    void this.process(bitmap, timestamp);
  }

  /** AR was switched off: a pending snapshot must not paint over the live passthrough. */
  dropPending(): void {
    if (isNil(this.pendingBitmap)) {
      return;
    }
    this.pendingBitmap.close();
    this.pendingBitmap = undefined;
    this.pendingTimestamp = 0;
  }

  dispose(): void {
    this.isDisposed = true;
    this.dropPending();
  }

  private async process(bitmap: ImageBitmap, timestamp: number): Promise<void> {
    const { landmarker, canvas, context, glassesImages, readStyle } = this.params;
    this.isProcessing = true;
    try {
      const detection = await landmarker.detect(bitmap, timestamp);
      const style = readStyle();
      if (this.isDisposed || style === 'none') {
        return;
      }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      if (isNil(detection)) {
        this.observeEmotion('neutral');
        return;
      }
      this.observeEmotion(classifyEmotion(detection.blendshapes));
      const transform = computeGlassesTransform(detection.landmarks, {
        width: canvas.width,
        height: canvas.height,
      });
      if (!isNil(transform)) {
        paintGlasses(context, glassesImages[style], transform);
      }
    } finally {
      bitmap.close();
      this.isProcessing = false;
      this.processPending();
    }
  }

  private processPending(): void {
    const next = this.pendingBitmap;
    if (isNil(next) || this.isDisposed || this.params.readStyle() === 'none') {
      this.dropPending();
      return;
    }
    const timestamp = this.pendingTimestamp;
    this.pendingBitmap = undefined;
    this.pendingTimestamp = 0;
    void this.process(next, timestamp);
  }

  private observeEmotion(next: TEmotion): void {
    const committed = this.emotion.observe(next);
    if (!isNil(committed)) {
      this.params.onEmotionChange(committed);
    }
  }
}
