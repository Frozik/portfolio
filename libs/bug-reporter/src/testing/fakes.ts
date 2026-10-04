import type { IAnnotation } from '../core/annotation';
import type {
  ICaptureMask,
  IDiagnosticsSource,
  IRecordingHandle,
  IRecordingResult,
  IReportSink,
  IScreenCapture,
  TSaveOutcome,
  TSaveStrategy,
} from '../core/ports';
import type { IRecordingFormat } from '../core/recording-format';
import type { IDiagnosticsCounts, IDiagnosticsSnapshot } from '../core/report';
import { createDiagnosticsSnapshot } from './report-fixture';

export const FAKE_FORMAT: IRecordingFormat = { mimeType: 'video/webm', extension: 'webm' };
export const FAKE_PNG = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });

export class FakeDiagnostics implements IDiagnosticsSource {
  sampling = false;
  disposed = false;

  constructor(private readonly data: IDiagnosticsSnapshot = createDiagnosticsSnapshot()) {}

  snapshot(): Promise<IDiagnosticsSnapshot> {
    return Promise.resolve(this.data);
  }

  counts(): IDiagnosticsCounts {
    return {
      console: this.data.console.length,
      errors: this.data.errors.length,
      breadcrumbs: this.data.breadcrumbs.length,
      network: this.data.network.length,
      performance: this.data.performance.longFrames.length + this.data.performance.vitals.length,
    };
  }

  startFrameSampling(): void {
    this.sampling = true;
  }

  stopFrameSampling(): void {
    this.sampling = false;
  }

  dispose(): void {
    this.disposed = true;
  }
}

export class FakeRecordingHandle implements IRecordingHandle {
  readonly finished: Promise<IRecordingResult>;
  stopped = false;
  private settle: ((result: IRecordingResult) => void) | null = null;

  constructor(private readonly durationMs = 1_500) {
    this.finished = new Promise(resolve => {
      this.settle = resolve;
    });
  }

  stop(): void {
    this.stopped = true;
    this.settle?.({ video: new Blob(['video']), format: FAKE_FORMAT, durationMs: this.durationMs });
  }
}

export class FakeScreenCapture implements IScreenCapture {
  supported = true;
  recordingFormat: IRecordingFormat | null = FAKE_FORMAT;
  grabs = 0;
  released = 0;
  nextGrab: () => Promise<Blob> = () => Promise.resolve(FAKE_PNG);
  nextRecording: () => Promise<IRecordingHandle> = () => Promise.resolve(new FakeRecordingHandle());
  private readonly endedListeners = new Set<() => void>();

  prepared = 0;
  nextPrepare: () => Promise<void> = () => Promise.resolve();

  prepare(): Promise<void> {
    this.prepared += 1;
    return this.nextPrepare();
  }

  grabFrame(): Promise<Blob> {
    this.grabs += 1;
    return this.nextGrab();
  }

  startRecording(): Promise<IRecordingHandle> {
    return this.nextRecording();
  }

  onEnded(listener: () => void): () => void {
    this.endedListeners.add(listener);
    return () => this.endedListeners.delete(listener);
  }

  release(): void {
    this.released += 1;
  }
}

export class FakeCaptureMask implements ICaptureMask {
  applied = 0;
  active = 0;

  apply(): Promise<() => void> {
    this.applied += 1;
    this.active += 1;
    let released = false;
    return Promise.resolve(() => {
      if (!released) {
        released = true;
        this.active -= 1;
      }
    });
  }
}

export class FakeReportSink implements IReportSink {
  readonly saved: { fileName: string; bytes: Uint8Array }[] = [];
  outcome: TSaveOutcome = 'saved';
  failWith: Error | null = null;

  constructor(readonly strategy: TSaveStrategy = 'file-system-access') {}

  async save(
    fileName: string,
    archive: ReadableStream<Uint8Array>,
    onProgress: (writtenBytes: number) => void
  ): Promise<TSaveOutcome> {
    if (this.failWith !== null) {
      throw this.failWith;
    }
    const bytes = new Uint8Array(await new Response(archive).arrayBuffer());
    onProgress(bytes.byteLength);
    if (this.outcome === 'saved') {
      this.saved.push({ fileName, bytes });
    }
    return this.outcome;
  }
}

export function flattenUnchanged(image: Blob, _annotation: IAnnotation): Promise<Blob> {
  return Promise.resolve(image);
}
