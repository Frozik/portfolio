import type { FileSinkStrategy } from '@frozik/utils/file-sink/file-sink';

import type { IRecordingFormat } from './recording-format';
import type { IBugReport, IDiagnosticsCounts, IDiagnosticsSnapshot } from './report';

export interface IDiagnosticsSource {
  snapshot(): Promise<IDiagnosticsSnapshot>;
  counts(): IDiagnosticsCounts;
  /** Frame timing is sampled only while a recording runs; the result rides along in the next snapshot. */
  startFrameSampling(): void;
  stopFrameSampling(): void;
  dispose(): void;
}

export type TCaptureFailure = 'unsupported' | 'denied' | 'ended' | 'failed';

export class CaptureError extends Error {
  constructor(
    readonly reason: TCaptureFailure,
    cause?: unknown
  ) {
    super(`Screen capture ${reason}`, { cause });
    this.name = 'CaptureError';
  }
}

export interface IRecordingResult {
  readonly video: Blob;
  readonly format: IRecordingFormat;
  readonly durationMs: number;
}

export interface IRecordingHandle {
  stop(): void;
  /** Settles when the recording ends for any reason: `stop()`, the duration limit or the browser's own stop-sharing control. */
  readonly finished: Promise<IRecordingResult>;
}

export interface IScreenCapture {
  readonly supported: boolean;
  /** `null` when the browser has no `MediaRecorder` format: screenshots still work, recording does not. */
  readonly recordingFormat: IRecordingFormat | null;
  /** Asks for the tab now, so the prompt is over before the person arranges what to capture. */
  prepare(): Promise<void>;
  grabFrame(): Promise<Blob>;
  startRecording(maxDurationMs: number): Promise<IRecordingHandle>;
  /** Fires when the browser's own stop-sharing control ends the stream outside the reporter's control. */
  onEnded(listener: () => void): () => void;
  release(): void;
}

export type TRestoreMask = () => void;

export interface ICaptureMask {
  /** Resolves once the masked frame is on screen, so nothing captured before it shows the data. */
  apply(): Promise<TRestoreMask>;
}

export type TSaveStrategy = FileSinkStrategy;
export type TSaveOutcome = 'saved' | 'cancelled';

export interface IReportSink {
  readonly strategy: TSaveStrategy;
  save(
    fileName: string,
    archive: ReadableStream<Uint8Array>,
    onProgress: (writtenBytes: number) => void
  ): Promise<TSaveOutcome>;
}

export type TArchiveBuilder = (report: IBugReport) => ReadableStream<Uint8Array>;
