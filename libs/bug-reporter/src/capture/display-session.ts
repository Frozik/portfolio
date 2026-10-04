import { isNil } from 'lodash-es';
import '../platform/browser-apis';

import { CaptureError } from '../core/ports';

export interface IDisplaySessionOptions {
  readonly maxFrameRate: number;
}

const IDEAL_FRAME_RATE = 15;

/**
 * One tab-capture permission per report: the stream is requested on first
 * use and shared by every screenshot and recording until released, so the
 * browser asks once, not per capture.
 */
export class DisplayCaptureSession {
  readonly supported: boolean =
    typeof navigator !== 'undefined' && !isNil(navigator.mediaDevices?.getDisplayMedia);

  private stream: MediaStream | null = null;
  private pending: Promise<MediaStream> | null = null;
  /** Bumped by `release`, so a stream the picker hands over afterwards is stopped instead of kept. */
  private epoch = 0;
  private readonly endedListeners = new Set<() => void>();

  constructor(private readonly options: IDisplaySessionOptions) {}

  get active(): boolean {
    return this.stream !== null;
  }

  acquire(): Promise<MediaStream> {
    if (this.stream !== null) {
      return Promise.resolve(this.stream);
    }
    this.pending ??= this.request().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  onEnded(listener: () => void): () => void {
    this.endedListeners.add(listener);
    return () => {
      this.endedListeners.delete(listener);
    };
  }

  release(): void {
    this.epoch += 1;
    const stream = this.stream;
    this.stream = null;
    stopTracks(stream);
  }

  private async request(): Promise<MediaStream> {
    if (!this.supported) {
      throw new CaptureError('unsupported');
    }
    const epoch = this.epoch;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser',
          frameRate: { ideal: IDEAL_FRAME_RATE, max: this.options.maxFrameRate },
        },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
        surfaceSwitching: 'exclude',
        monitorTypeSurfaces: 'exclude',
      });
    } catch (error) {
      throw new CaptureError(isPermissionDenial(error) ? 'denied' : 'failed', error);
    }
    const [track] = stream.getVideoTracks();
    if (isNil(track)) {
      stopTracks(stream);
      throw new CaptureError('failed');
    }
    if (epoch !== this.epoch) {
      stopTracks(stream);
      throw new CaptureError('ended');
    }
    track.addEventListener('ended', () => {
      if (this.stream === stream) {
        this.stream = null;
        this.endedListeners.forEach(listener => listener());
      }
    });
    this.stream = stream;
    return stream;
  }
}

function isPermissionDenial(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotAllowedError';
}

function stopTracks(stream: MediaStream | null): void {
  stream?.getTracks().forEach(track => track.stop());
}
