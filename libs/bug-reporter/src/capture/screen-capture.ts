import type { IRecordingHandle, IScreenCapture } from '../core/ports';
import { CaptureError } from '../core/ports';
import type { IRecordingFormat } from '../core/recording-format';
import { pickRecordingFormat } from '../core/recording-format';
import type { IDisplaySessionOptions } from './display-session';
import { DisplayCaptureSession } from './display-session';
import { recordStream } from './recorder';
import { grabFrame } from './screenshot';

export interface IScreenCaptureOptions extends IDisplaySessionOptions {
  readonly videoBitsPerSecond: number;
}

/** The browser's tab capture behind the reporter's port: screenshots and recordings from one shared stream. */
export class DisplayScreenCapture implements IScreenCapture {
  readonly recordingFormat: IRecordingFormat | null;
  private readonly session: DisplayCaptureSession;

  constructor(private readonly options: IScreenCaptureOptions) {
    this.session = new DisplayCaptureSession(options);
    this.recordingFormat =
      typeof MediaRecorder === 'function'
        ? pickRecordingFormat(mimeType => MediaRecorder.isTypeSupported(mimeType))
        : null;
  }

  get supported(): boolean {
    return this.session.supported;
  }

  onEnded(listener: () => void): () => void {
    return this.session.onEnded(listener);
  }

  async prepare(): Promise<void> {
    await this.session.acquire();
  }

  async grabFrame(): Promise<Blob> {
    return grabFrame(await this.session.acquire());
  }

  async startRecording(maxDurationMs: number): Promise<IRecordingHandle> {
    const format = this.recordingFormat;
    if (format === null) {
      throw new CaptureError('unsupported');
    }
    const stream = await this.session.acquire();
    return recordStream(stream, {
      format,
      maxDurationMs,
      videoBitsPerSecond: this.options.videoBitsPerSecond,
    });
  }

  release(): void {
    this.session.release();
  }
}
