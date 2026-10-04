import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createArchiveStream } from '../archive/create-archive-stream';
import { BugReporter } from '../reporter/bug-reporter';
import {
  FakeCaptureMask,
  FakeDiagnostics,
  FakeReportSink,
  FakeScreenCapture,
  flattenUnchanged,
} from '../testing/fakes';
import { FIXTURE_TIME } from '../testing/report-fixture';
import { BugReporterWidget } from './BugReporterWidget';

function createReporter() {
  const sink = new FakeReportSink();
  const reporter = new BugReporter({
    diagnostics: new FakeDiagnostics(),
    capture: new FakeScreenCapture(),
    mask: new FakeCaptureMask(),
    buildArchive: createArchiveStream,
    sink,
    flatten: flattenUnchanged,
    showClickMarks: () => () => undefined,
    now: () => FIXTURE_TIME,
    maxRecordingMs: 10_000,
    countdownSeconds: 1,
  });
  return { reporter, sink };
}

describe('BugReporterWidget', () => {
  beforeEach(() => {
    vi.stubGlobal('createImageBitmap', () => new Promise(() => undefined));
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: () => 'blob:fake',
      revokeObjectURL: () => undefined,
    });
    HTMLElement.prototype.showPopover ??= function showPopover() {
      this.setAttribute('data-open', '');
    };
    HTMLElement.prototype.hidePopover ??= function hidePopover() {
      this.removeAttribute('data-open');
    };
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('follows the popover the bug button invokes: open shows the three-way menu, light dismiss cancels', () => {
    const { reporter } = createReporter();
    render(<BugReporterWidget reporter={reporter} locale="en" />);
    const button = screen.getByRole('button', { name: 'Report a problem' });
    const menu = screen.getByRole('menu', { hidden: true });
    expect(button.getAttribute('popovertarget')).toBe(menu.id);

    fireEvent(menu, Object.assign(new Event('toggle'), { newState: 'open', oldState: 'closed' }));

    expect(reporter.snapshot.phase.kind).toBe('choosing');
    expect(screen.getByRole('menuitem', { name: 'Screenshot' })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: 'Record screen' })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: 'Just describe' })).toBeDefined();

    fireEvent(menu, Object.assign(new Event('toggle'), { newState: 'closed', oldState: 'open' }));

    expect(reporter.snapshot.phase.kind).toBe('idle');
  });

  it('opens with the keyboard shortcut', () => {
    const { reporter } = createReporter();
    render(<BugReporterWidget reporter={reporter} locale="en" />);

    fireEvent.keyDown(document, { code: 'KeyB', ctrlKey: true, shiftKey: true });

    expect(reporter.snapshot.phase.kind).toBe('choosing');
  });

  it('leads from "just describe" to a compose dialog whose checklist drives the archive', async () => {
    const { reporter, sink } = createReporter();
    render(<BugReporterWidget reporter={reporter} locale="en" />);
    act(() => reporter.open());
    fireEvent.click(screen.getByRole('menuitem', { name: 'Just describe' }));

    const comment = screen.getByRole('textbox', { name: 'What happened?' });
    fireEvent.change(comment, { target: { value: 'Balance shows NaN' } });
    expect(reporter.snapshot.included.console).toBe(false);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Console (0)' }));
    expect(reporter.snapshot.included.console).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Download report (.zip)' }));
    await waitFor(() => expect(screen.getByText('Report saved')).toBeDefined());

    expect(sink.saved[0]?.fileName).toBe('bug-report-2026-10-04T12-30-00.zip');
    expect(screen.getByText('Saved as bug-report-2026-10-04T12-30-00.zip.')).toBeDefined();
  });

  it('shows the screenshot editor after a capture and keeps the screenshot on "use"', async () => {
    const { reporter } = createReporter();
    render(<BugReporterWidget reporter={reporter} locale="en" />);
    act(() => reporter.open());

    await act(() => reporter.takeScreenshot());

    expect(screen.getByRole('toolbar', { name: 'Mark what matters' })).toBeDefined();
    expect(document.querySelector('.bug-reporter-flash')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Highlight', pressed: true })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Thin line', pressed: true })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Thick line' }));
    expect(screen.getByRole('button', { name: 'Thick line', pressed: true })).toBeDefined();
    fireEvent.load(screen.getByRole('presentation'));
    act(() => reporter.finishAnnotation({ shapes: [], undone: [] }));

    expect(reporter.snapshot.phase.kind).toBe('composing');
    expect(screen.getByRole('button', { name: 'Remove' })).toBeDefined();
  });

  it('drives a recording from the fixed bar: start, countdown, timer, stop', async () => {
    vi.useFakeTimers();
    const { reporter } = createReporter();
    render(<BugReporterWidget reporter={reporter} locale="en" />);
    act(() => reporter.open());
    await act(() => reporter.armRecording());

    expect(screen.getByText('Arrange the page, then start recording.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Start recording' }));
    expect(screen.getByText('Recording starts in')).toBeDefined();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(reporter.snapshot.phase.kind).toBe('recording');
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(reporter.snapshot.phase.kind).toBe('composing');
    vi.useRealTimers();
  });

  it('offers "take screenshot" from the bar once the tab is shared', async () => {
    const { reporter } = createReporter();
    render(<BugReporterWidget reporter={reporter} locale="en" />);
    act(() => reporter.open());
    await act(() => reporter.armScreenshot());

    fireEvent.click(screen.getByRole('button', { name: 'Take screenshot' }));
    await waitFor(() => expect(reporter.snapshot.phase.kind).toBe('annotating'));
  });

  it('reopens the compose dialog when the browser force-closes it, keeping the draft', () => {
    const { reporter } = createReporter();
    render(<BugReporterWidget reporter={reporter} locale="en" />);
    act(() => reporter.open());
    act(() => reporter.describeOnly());
    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(dialog).toBeInstanceOf(HTMLDialogElement);
    if (!(dialog instanceof HTMLDialogElement)) {
      return;
    }
    const showModal = vi.spyOn(dialog, 'showModal');
    act(() => reporter.setComment('half-written'));

    dialog.close();
    fireEvent(dialog, new Event('close'));

    expect(showModal).toHaveBeenCalled();
    expect(reporter.snapshot.phase.kind).toBe('composing');
    expect(reporter.snapshot.comment).toBe('half-written');
  });

  it('speaks Russian when asked', () => {
    const { reporter } = createReporter();
    render(<BugReporterWidget reporter={reporter} locale="ru-RU" />);
    expect(screen.getByRole('button', { name: 'Сообщить о проблеме' })).toBeDefined();
  });
});
