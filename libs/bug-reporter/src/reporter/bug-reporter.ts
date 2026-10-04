import type { ISO } from '@frozik/utils/date/types';
import { reportError } from '@frozik/utils/diagnostics/reportError';
import { DisposableBag } from '@frozik/utils/disposable/DisposableBag';

import type { IAnnotation } from '../core/annotation';
import { archiveFileName } from '../core/archive-layout';
import type { TNow } from '../core/clock';
import { deferStream } from '../core/defer-stream';
import type {
  ICaptureMask,
  IDiagnosticsSource,
  IRecordingHandle,
  IReportSink,
  IScreenCapture,
  TArchiveBuilder,
  TRestoreMask,
} from '../core/ports';
import { CaptureError } from '../core/ports';
import type {
  IBugReport,
  IDiagnosticsCounts,
  TAttachment,
  TDiagnosticsSection,
} from '../core/report';
import { REPORT_SCHEMA_VERSION } from '../core/report';
import type { IReadableStore } from '../core/store';
import { Store } from '../core/store';
import type {
  IReporterState,
  TCaptureMode,
  TDraftAttachment,
  TReporterNotice,
  TReporterPhase,
} from './state';
import { initialReporterState } from './state';

export interface IBugReporterDependencies {
  readonly diagnostics: IDiagnosticsSource;
  readonly capture: IScreenCapture;
  readonly mask: ICaptureMask;
  readonly buildArchive: TArchiveBuilder;
  readonly sink: IReportSink;
  readonly flatten: (image: Blob, annotation: IAnnotation) => Promise<Blob>;
  readonly showClickMarks: () => () => void;
  readonly now: TNow;
  readonly maxRecordingMs: number;
  readonly countdownSeconds: number;
}

const SECOND_MS = 1_000;
const COUNTED_SECTIONS: readonly (keyof IDiagnosticsCounts)[] = [
  'console',
  'errors',
  'breadcrumbs',
  'network',
  'performance',
];

/**
 * The report session as a state machine (plan §6.3): one capture permission
 * per report, the mask held exactly for the span of a capture, diagnostics
 * snapshotted at download so they include everything up to that moment.
 */
export class BugReporter {
  readonly store: IReadableStore<IReporterState>;
  private readonly state: Store<IReporterState>;
  private readonly bag = new DisposableBag();
  private recording: { readonly handle: IRecordingHandle; readonly release: () => void } | null =
    null;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private attachmentCounter = 0;
  /** Bumped by `cancel`, so a capture that was in flight when the person left the flow cannot write into the next one. */
  private flow = 0;
  /** Sections the person ticked or cleared by hand; the empty-section default leaves those alone. */
  private readonly chosenSections = new Set<TDiagnosticsSection>();

  constructor(private readonly deps: IBugReporterDependencies) {
    this.state = new Store(
      initialReporterState({
        screenshot: deps.capture.supported,
        recording: deps.capture.supported && deps.capture.recordingFormat !== null,
        saveStrategy: deps.sink.strategy,
      })
    );
    this.store = this.state;
    this.bag.add(() => deps.diagnostics.dispose());
    this.bag.add(() => deps.capture.release());
  }

  get snapshot(): IReporterState {
    return this.state.getSnapshot();
  }

  readonly open = (): void => {
    if (this.snapshot.phase.kind === 'idle') {
      this.setPhase({ kind: 'choosing' });
    }
  };

  /** Leaves the flow from any phase and releases every capture resource; the draft is discarded. */
  readonly cancel = (): void => {
    this.flow += 1;
    this.chosenSections.clear();
    this.clearCountdown();
    this.recording?.handle.stop();
    this.deps.capture.release();
    this.state.set({ ...initialReporterState(this.snapshot.capability) });
  };

  readonly describeOnly = (): void => {
    this.setPhase({ kind: 'composing' });
  };

  /** Puts the capture bar up: the tab is requested now, the capture itself waits for the bar's button. */
  readonly arm = async (mode: TCaptureMode): Promise<void> => {
    if (mode === 'recording' && !this.snapshot.capability.recording) {
      this.setPhase(this.fallbackPhase(), 'recording-unsupported');
      return;
    }
    const flow = this.flow;
    this.setPhase({ kind: 'arming', mode }, null);
    try {
      await this.deps.capture.prepare();
      if (flow === this.flow) {
        this.setPhase({ kind: 'armed', mode });
      }
    } catch (error) {
      if (flow === this.flow) {
        this.setPhase(this.fallbackPhase(), captureNotice(error));
      }
    }
  };

  readonly armScreenshot = (): Promise<void> => this.arm('screenshot');

  readonly armRecording = (): Promise<void> => this.arm('recording');

  /** Takes the capture bar down without capturing; the draft stays. */
  readonly disarm = (): void => {
    this.setPhase(this.fallbackPhase());
  };

  readonly takeScreenshot = async (): Promise<void> => {
    const flow = this.flow;
    this.setPhase({ kind: 'capturing' }, null);
    let restore: TRestoreMask | null = null;
    try {
      restore = await this.deps.mask.apply();
      const image = await this.deps.capture.grabFrame();
      if (flow === this.flow) {
        this.setPhase({ kind: 'annotating', screenshot: { id: this.nextId('screenshot'), image } });
      }
    } catch (error) {
      if (flow === this.flow) {
        this.setPhase(this.fallbackPhase(), captureNotice(error));
      }
    } finally {
      restore?.();
    }
  };

  readonly finishAnnotation = (annotation: IAnnotation): void => {
    const { phase } = this.snapshot;
    if (phase.kind !== 'annotating') {
      return;
    }
    this.state.update(state => ({
      ...this.composing(state),
      attachments: [...state.attachments, { ...phase.screenshot, kind: 'screenshot', annotation }],
    }));
  };

  readonly discardScreenshot = (): void => {
    this.setPhase(this.fallbackPhase());
  };

  readonly startRecording = (): void => {
    if (!this.snapshot.capability.recording) {
      this.setPhase(this.fallbackPhase(), 'recording-unsupported');
      return;
    }
    this.clearCountdown();
    let secondsLeft = this.deps.countdownSeconds;
    this.setPhase({ kind: 'countdown', secondsLeft }, null);
    this.countdownTimer = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft > 0) {
        this.setPhase({ kind: 'countdown', secondsLeft });
        return;
      }
      this.clearCountdown();
      void this.beginRecording();
    }, SECOND_MS);
  };

  readonly stopRecording = (): void => {
    this.recording?.handle.stop();
  };

  readonly removeAttachment = (id: string): void => {
    this.state.update(state => ({
      ...state,
      attachments: state.attachments.filter(attachment => attachment.id !== id),
    }));
  };

  readonly setComment = (comment: string): void => {
    this.state.update(state => ({ ...state, comment }));
  };

  readonly setIncluded = (section: TDiagnosticsSection, included: boolean): void => {
    this.chosenSections.add(section);
    this.state.update(state => ({
      ...state,
      included: { ...state.included, [section]: included },
    }));
  };

  /** A second press while packaging is a double click: only the compose step starts a download. */
  readonly download = async (): Promise<void> => {
    if (this.snapshot.phase.kind !== 'composing') {
      return;
    }
    this.setPhase({ kind: 'packaging', writtenBytes: 0 }, null);
    try {
      const createdAt = this.deps.now();
      const fileName = archiveFileName(createdAt);
      const archive = deferStream(async () =>
        this.deps.buildArchive(await this.buildReport(createdAt))
      );
      const outcome = await this.deps.sink.save(fileName, archive, writtenBytes =>
        this.setPhase({ kind: 'packaging', writtenBytes })
      );
      if (outcome === 'cancelled') {
        this.setPhase({ kind: 'composing' });
        return;
      }
      this.deps.capture.release();
      this.setPhase({ kind: 'done', fileName });
    } catch (error) {
      reportError('Bug reporter: saving the archive failed', error);
      this.setPhase({ kind: 'composing' }, 'save-failed');
    }
  };

  readonly dispose = (): void => {
    this.cancel();
    this.bag.disposeAll();
  };

  private async beginRecording(): Promise<void> {
    const flow = this.flow;
    let restore: TRestoreMask | null = null;
    try {
      restore = await this.deps.mask.apply();
      const handle = await this.deps.capture.startRecording(this.deps.maxRecordingMs);
      if (flow !== this.flow) {
        handle.stop();
        restore();
        return;
      }
      const hideClickMarks = this.deps.showClickMarks();
      this.deps.diagnostics.startFrameSampling();
      const releaseMask = restore;
      restore = null;
      this.recording = {
        handle,
        release: () => {
          hideClickMarks();
          releaseMask();
          this.deps.diagnostics.stopFrameSampling();
        },
      };
      this.setPhase({
        kind: 'recording',
        startedAt: performance.now(),
        maxDurationMs: this.deps.maxRecordingMs,
      });
      const result = await handle.finished;
      this.recording.release();
      this.recording = null;
      if (flow !== this.flow) {
        return;
      }
      this.state.update(state => ({
        ...this.composing(state),
        notice: result.durationMs >= this.deps.maxRecordingMs ? 'recording-limit' : state.notice,
        attachments: [
          ...state.attachments,
          {
            kind: 'recording',
            id: this.nextId('recording'),
            video: result.video,
            format: result.format,
            durationMs: result.durationMs,
          },
        ],
      }));
    } catch (error) {
      this.recording?.release();
      this.recording = null;
      restore?.();
      if (flow === this.flow) {
        this.setPhase(this.fallbackPhase(), captureNotice(error));
      }
    }
  }

  private async buildReport(createdAt: ISO): Promise<IBugReport> {
    const { comment, included, attachments } = this.snapshot;
    const [diagnostics, flattened] = await Promise.all([
      this.deps.diagnostics.snapshot(),
      Promise.all(attachments.map(attachment => this.flattenDraft(attachment))),
    ]);
    return {
      schemaVersion: REPORT_SCHEMA_VERSION,
      createdAt,
      comment,
      included,
      diagnostics,
      attachments: flattened,
    };
  }

  private async flattenDraft(draft: TDraftAttachment): Promise<TAttachment> {
    switch (draft.kind) {
      case 'screenshot':
        return {
          kind: 'screenshot',
          id: draft.id,
          image: await this.deps.flatten(draft.image, draft.annotation),
        };
      case 'recording':
        return draft;
      default:
        return draft satisfies never;
    }
  }

  /** After a failed or abandoned capture the flow returns to where the draft is: the menu, or the compose step once something was collected. */
  private fallbackPhase(): TReporterPhase {
    const { attachments, comment } = this.snapshot;
    return attachments.length > 0 || comment !== '' ? { kind: 'composing' } : { kind: 'choosing' };
  }

  private setPhase(phase: TReporterPhase, notice?: TReporterNotice | null): void {
    this.state.update(state => ({
      ...(phase.kind === 'composing' ? this.composing(state) : { ...state, phase }),
      notice: notice === undefined ? state.notice : notice,
    }));
  }

  /**
   * Entering the compose step refreshes the counts and, for every section the
   * person has not decided on, ticks it only when there is something in it —
   * an empty section in the archive is noise, a cleared one is a choice kept.
   */
  private composing(state: IReporterState): IReporterState {
    const counts = this.deps.diagnostics.counts();
    const included = { ...state.included };
    for (const section of COUNTED_SECTIONS) {
      if (!this.chosenSections.has(section)) {
        included[section] = counts[section] > 0;
      }
    }
    return { ...state, phase: { kind: 'composing' }, counts, included };
  }

  private clearCountdown(): void {
    if (this.countdownTimer !== null) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  private nextId(kind: string): string {
    this.attachmentCounter += 1;
    return `${kind}-${this.attachmentCounter}`;
  }
}

/** Every failed capture is also written to the console with its cause: the notice is for the person, the log is for whoever debugs it. */
function captureNotice(error: unknown): TReporterNotice {
  reportError('Bug reporter: screen capture failed', error);
  if (!(error instanceof CaptureError)) {
    return 'capture-failed';
  }
  switch (error.reason) {
    case 'unsupported':
      return 'capture-unsupported';
    case 'denied':
      return 'capture-denied';
    case 'ended':
    case 'failed':
      return 'capture-failed';
    default:
      return error.reason satisfies never;
  }
}
