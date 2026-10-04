import { strFromU8, unzipSync } from 'fflate';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createArchiveStream } from '../archive/create-archive-stream';
import { EMPTY_ANNOTATION } from '../core/annotation';
import { CaptureError } from '../core/ports';
import {
  FakeCaptureMask,
  FakeDiagnostics,
  FakeRecordingHandle,
  FakeReportSink,
  FakeScreenCapture,
  flattenUnchanged,
} from '../testing/fakes';
import {
  createBugReport,
  createDiagnosticsSnapshot,
  FIXTURE_TIME,
} from '../testing/report-fixture';
import { BugReporter } from './bug-reporter';

function createReporter() {
  const capture = new FakeScreenCapture();
  const mask = new FakeCaptureMask();
  const sink = new FakeReportSink();
  const diagnostics = new FakeDiagnostics();
  const clickMarks = { shown: 0, hidden: 0 };
  const reporter = new BugReporter({
    diagnostics,
    capture,
    mask,
    buildArchive: createArchiveStream,
    sink,
    flatten: flattenUnchanged,
    showClickMarks: () => {
      clickMarks.shown += 1;
      return () => {
        clickMarks.hidden += 1;
      };
    },
    now: () => FIXTURE_TIME,
    maxRecordingMs: 10_000,
    countdownSeconds: 2,
  });
  return { reporter, capture, mask, sink, diagnostics, clickMarks };
}

function silencedConsoleError() {
  return vi.spyOn(console, 'error').mockImplementation(() => undefined);
}

describe('BugReporter', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('walks screenshot → annotate → compose → download → done and names the archive by its time', async () => {
    const { reporter, sink, capture } = createReporter();
    reporter.open();
    expect(reporter.snapshot.phase.kind).toBe('choosing');

    await reporter.takeScreenshot();
    expect(reporter.snapshot.phase.kind).toBe('annotating');
    reporter.finishAnnotation(EMPTY_ANNOTATION);
    expect(reporter.snapshot.phase.kind).toBe('composing');
    expect(reporter.snapshot.attachments.map(attachment => attachment.kind)).toEqual([
      'screenshot',
    ]);

    reporter.setComment('The total is off by one');
    await reporter.download();

    expect(reporter.snapshot.phase).toEqual({
      kind: 'done',
      fileName: 'bug-report-2026-10-04T12-30-00.zip',
    });
    const archive = unzipSync(sink.saved[0]?.bytes ?? new Uint8Array());
    expect(Object.keys(archive)).toContain('screenshots/1.png');
    expect(strFromU8(archive['report.md'] ?? new Uint8Array())).toContain(
      'The total is off by one'
    );
    expect(capture.released).toBeGreaterThan(0);
  });

  it("arms a screenshot by asking for the tab first, then captures on the bar's button", async () => {
    const { reporter, capture } = createReporter();
    reporter.open();

    await reporter.armScreenshot();

    expect(reporter.snapshot.phase).toEqual({ kind: 'armed', mode: 'screenshot' });
    expect(capture.prepared).toBe(1);
    expect(capture.grabs).toBe(0);

    await reporter.takeScreenshot();
    expect(reporter.snapshot.phase.kind).toBe('annotating');
  });

  it('returns to the menu with a notice when the tab request is refused while arming, logging the cause', async () => {
    const consoleError = silencedConsoleError();
    const { reporter, capture } = createReporter();
    const refusal = new CaptureError('denied');
    capture.nextPrepare = () => Promise.reject(refusal);
    reporter.open();

    await reporter.armRecording();

    expect(reporter.snapshot.phase.kind).toBe('choosing');
    expect(reporter.snapshot.notice).toBe('capture-denied');
    expect(consoleError).toHaveBeenCalledWith('Bug reporter: screen capture failed:', refusal);
  });

  it('disarms back to where the draft is', async () => {
    const { reporter } = createReporter();
    reporter.open();
    reporter.describeOnly();
    reporter.setComment('draft');
    await reporter.armRecording();

    reporter.disarm();

    expect(reporter.snapshot.phase.kind).toBe('composing');
    expect(reporter.snapshot.comment).toBe('draft');
  });

  it('holds the mask only for the span of the screenshot', async () => {
    const { reporter, mask, capture } = createReporter();
    reporter.open();
    capture.nextGrab = () => {
      expect(mask.active).toBe(1);
      return Promise.resolve(new Blob(['png']));
    };

    await reporter.takeScreenshot();

    expect(mask.applied).toBe(1);
    expect(mask.active).toBe(0);
  });

  it('returns to the menu with a notice when the person refuses tab capture, logging the cause', async () => {
    const consoleError = silencedConsoleError();
    const { reporter, capture, mask } = createReporter();
    reporter.open();
    const refusal = new CaptureError('denied');
    capture.nextGrab = () => Promise.reject(refusal);

    await reporter.takeScreenshot();

    expect(reporter.snapshot.phase.kind).toBe('choosing');
    expect(reporter.snapshot.notice).toBe('capture-denied');
    expect(mask.active).toBe(0);
    expect(consoleError).toHaveBeenCalledWith('Bug reporter: screen capture failed:', refusal);
  });

  it('counts down, records with click marks and frame sampling, and lands in compose with the video', async () => {
    vi.useFakeTimers();
    const { reporter, capture, mask, diagnostics, clickMarks } = createReporter();
    const handle = new FakeRecordingHandle(4_000);
    capture.nextRecording = () => Promise.resolve(handle);
    reporter.open();
    reporter.startRecording();
    expect(reporter.snapshot.phase).toEqual({ kind: 'countdown', secondsLeft: 2 });

    vi.advanceTimersByTime(1_000);
    expect(reporter.snapshot.phase).toEqual({ kind: 'countdown', secondsLeft: 1 });
    vi.advanceTimersByTime(1_000);
    await vi.waitFor(() => expect(reporter.snapshot.phase.kind).toBe('recording'));
    expect(mask.active).toBe(1);
    expect(diagnostics.sampling).toBe(true);
    expect(clickMarks.shown).toBe(1);

    reporter.stopRecording();
    await vi.waitFor(() => expect(reporter.snapshot.phase.kind).toBe('composing'));

    expect(mask.active).toBe(0);
    expect(diagnostics.sampling).toBe(false);
    expect(clickMarks.hidden).toBe(1);
    expect(reporter.snapshot.attachments[0]).toMatchObject({
      kind: 'recording',
      durationMs: 4_000,
    });
  });

  it('flags a recording that ran into the duration limit', async () => {
    vi.useFakeTimers();
    const { reporter, capture } = createReporter();
    const handle = new FakeRecordingHandle(10_000);
    capture.nextRecording = () => Promise.resolve(handle);
    reporter.open();
    reporter.startRecording();
    vi.advanceTimersByTime(2_000);
    await vi.waitFor(() => expect(reporter.snapshot.phase.kind).toBe('recording'));

    handle.stop();
    await vi.waitFor(() => expect(reporter.snapshot.phase.kind).toBe('composing'));

    expect(reporter.snapshot.notice).toBe('recording-limit');
  });

  it('offers no recording when the browser has no recorder', () => {
    const { capture, mask, diagnostics, sink } = createReporter();
    capture.recordingFormat = null;
    const reporter = new BugReporter({
      diagnostics,
      capture,
      mask,
      buildArchive: createArchiveStream,
      sink,
      flatten: flattenUnchanged,
      showClickMarks: () => () => undefined,
      now: () => FIXTURE_TIME,
      maxRecordingMs: 10_000,
      countdownSeconds: 2,
    });

    expect(reporter.snapshot.capability).toMatchObject({ screenshot: true, recording: false });
    reporter.open();
    reporter.startRecording();
    expect(reporter.snapshot.notice).toBe('recording-unsupported');
    expect(reporter.snapshot.phase.kind).toBe('choosing');
  });

  it('keeps an excluded section out of the archive', async () => {
    const { reporter, sink } = createReporter();
    reporter.open();
    reporter.describeOnly();
    reporter.setIncluded('console', false);
    reporter.setIncluded('environment', false);

    await reporter.download();

    const archive = unzipSync(sink.saved[0]?.bytes ?? new Uint8Array());
    expect(Object.keys(archive)).not.toContain('console.txt');
    expect(JSON.parse(strFromU8(archive['report.json'] ?? new Uint8Array()))).not.toHaveProperty(
      'environment'
    );
  });

  it('goes back to compose when the save dialog is dismissed, and reports a failed save', async () => {
    const consoleError = silencedConsoleError();
    const { reporter, sink } = createReporter();
    reporter.open();
    reporter.describeOnly();
    sink.outcome = 'cancelled';
    await reporter.download();
    expect(reporter.snapshot.phase.kind).toBe('composing');
    expect(reporter.snapshot.notice).toBeNull();

    sink.outcome = 'saved';
    const diskFull = new Error('disk full');
    sink.failWith = diskFull;
    await reporter.download();
    expect(reporter.snapshot.phase.kind).toBe('composing');
    expect(reporter.snapshot.notice).toBe('save-failed');
    expect(consoleError).toHaveBeenCalledWith('Bug reporter: saving the archive failed:', diskFull);
  });

  it('cancel from any step drops the draft and releases the capture', async () => {
    const { reporter, capture } = createReporter();
    reporter.open();
    await reporter.takeScreenshot();
    reporter.finishAnnotation(EMPTY_ANNOTATION);
    reporter.setComment('draft');

    reporter.cancel();

    expect(reporter.snapshot.phase.kind).toBe('idle');
    expect(reporter.snapshot.attachments).toEqual([]);
    expect(reporter.snapshot.comment).toBe('');
    expect(capture.released).toBe(1);
  });

  it('ignores a frame that arrives after the person cancelled the capture', async () => {
    const { reporter, capture, mask } = createReporter();
    let deliver: (image: Blob) => void = () => undefined;
    capture.nextGrab = () =>
      new Promise(resolve => {
        deliver = resolve;
      });
    reporter.open();
    const capturing = reporter.takeScreenshot();
    await vi.waitFor(() => expect(mask.active).toBe(1));

    reporter.cancel();
    deliver(new Blob(['late']));
    await capturing;

    expect(reporter.snapshot.phase.kind).toBe('idle');
    expect(mask.active).toBe(0);
  });

  it('discards a recording that was stopped by cancel', async () => {
    vi.useFakeTimers();
    const { reporter, capture, mask } = createReporter();
    const handle = new FakeRecordingHandle(2_000);
    capture.nextRecording = () => Promise.resolve(handle);
    reporter.open();
    reporter.startRecording();
    vi.advanceTimersByTime(2_000);
    await vi.waitFor(() => expect(reporter.snapshot.phase.kind).toBe('recording'));

    reporter.cancel();
    await vi.waitFor(() => expect(handle.stopped).toBe(true));
    await Promise.resolve();

    expect(reporter.snapshot.phase.kind).toBe('idle');
    expect(reporter.snapshot.attachments).toEqual([]);
    expect(mask.active).toBe(0);
  });

  it('confirms the editor at once and flattens the marks only when the archive is built', async () => {
    let flattened = 0;
    const { reporter, sink } = createReporter();
    const flattening = new BugReporter({
      diagnostics: new FakeDiagnostics(),
      capture: new FakeScreenCapture(),
      mask: new FakeCaptureMask(),
      buildArchive: createArchiveStream,
      sink,
      flatten: image => {
        flattened += 1;
        return Promise.resolve(image);
      },
      showClickMarks: () => () => undefined,
      now: () => FIXTURE_TIME,
      maxRecordingMs: 10_000,
      countdownSeconds: 2,
    });
    flattening.open();
    await flattening.takeScreenshot();
    flattening.finishAnnotation(EMPTY_ANNOTATION);

    expect(flattening.snapshot.phase.kind).toBe('composing');
    expect(flattened).toBe(0);

    await flattening.download();

    expect(flattened).toBe(1);
    expect(sink.saved[0]?.fileName).toBeDefined();
    reporter.dispose();
  });

  it('opens the save dialog before the diagnostics are assembled', async () => {
    const { reporter, sink, diagnostics } = createReporter();
    let snapshots = 0;
    diagnostics.snapshot = () => {
      snapshots += 1;
      return Promise.resolve(createBugReport().diagnostics);
    };
    let snapshotsWhenSaveStarted = -1;
    const save = sink.save.bind(sink);
    sink.save = (fileName, archive, onProgress) => {
      snapshotsWhenSaveStarted = snapshots;
      return save(fileName, archive, onProgress);
    };
    reporter.open();
    reporter.describeOnly();

    await reporter.download();

    expect(snapshotsWhenSaveStarted).toBe(0);
    expect(snapshots).toBe(1);
    expect(reporter.snapshot.phase.kind).toBe('done');
  });

  it('shows the collected counts on entering the compose step', async () => {
    const diagnostics = new FakeDiagnostics(
      createDiagnosticsSnapshot({
        console: [{ timestamp: FIXTURE_TIME, level: 'error', message: 'x', count: 1 }],
        errors: [
          {
            timestamp: FIXTURE_TIME,
            kind: 'uncaught',
            message: 'y',
            stack: null,
            source: null,
            count: 2,
          },
        ],
      })
    );
    const reporter = new BugReporter({
      diagnostics,
      capture: new FakeScreenCapture(),
      mask: new FakeCaptureMask(),
      buildArchive: createArchiveStream,
      sink: new FakeReportSink(),
      flatten: flattenUnchanged,
      showClickMarks: () => () => undefined,
      now: () => FIXTURE_TIME,
      maxRecordingMs: 10_000,
      countdownSeconds: 2,
    });
    reporter.open();
    reporter.describeOnly();

    expect(reporter.snapshot.counts).toEqual({
      console: 1,
      errors: 1,
      breadcrumbs: 0,
      network: 0,
      performance: 0,
    });
    expect(reporter.snapshot.included).toEqual({
      console: true,
      errors: true,
      breadcrumbs: false,
      network: false,
      performance: false,
      environment: true,
    });
  });

  it('keeps a section the person decided on, whatever its count', async () => {
    const { reporter } = createReporter();
    reporter.open();
    reporter.describeOnly();
    expect(reporter.snapshot.included.network).toBe(false);

    reporter.setIncluded('network', true);
    reporter.setIncluded('environment', false);
    await reporter.armScreenshot();
    reporter.disarm();

    expect(reporter.snapshot.included.network).toBe(true);
    expect(reporter.snapshot.included.environment).toBe(false);
  });

  it('dispose stops the diagnostics collectors', () => {
    const { reporter, diagnostics } = createReporter();
    reporter.dispose();
    expect(diagnostics.disposed).toBe(true);
  });
});
