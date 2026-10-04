import { getNowISO8601 } from '@frozik/utils/date/now';

import { createArchiveStream } from '../archive/create-archive-stream';
import { showClickMarks } from '../capture/click-marks';
import { DomCaptureMask } from '../capture/masking';
import { rasterizeAnnotation } from '../capture/rasterize-annotation';
import { DisplayScreenCapture } from '../capture/screen-capture';
import { DEFAULT_DIAGNOSTICS_LIMITS, DiagnosticsHub } from '../collectors/diagnostics';
import { createReportSink } from '../delivery/save-strategy';
import { BugReporter } from './bug-reporter';
import type { IBugReporterOptions } from './options';
import {
  DEFAULT_COUNTDOWN_SECONDS,
  DEFAULT_MAX_FRAME_RATE,
  DEFAULT_MAX_RECORDING_MS,
  DEFAULT_VIDEO_BITS_PER_SECOND,
} from './options';

/** The widget root class; anything inside it is the reporter's own UI, not the page under report. */
export const WIDGET_CLASS = 'bug-reporter';

/**
 * The composition root: the reporter wired to the browser. Create it once,
 * at application start, so the diagnostics history begins before the bug.
 */
export function createBugReporter(options: Partial<IBugReporterOptions> = {}): BugReporter {
  const now = options.now ?? getNowISO8601;
  const appRoot = options.appRoot ?? null;
  const clickMarkHost = appRoot instanceof HTMLElement ? appRoot : document.body;
  return new BugReporter({
    diagnostics: new DiagnosticsHub({
      now,
      limits: { ...DEFAULT_DIAGNOSTICS_LIMITS, ...options.limits },
      ignoreWithin: target => target.closest(`.${WIDGET_CLASS}`) !== null,
    }),
    capture: new DisplayScreenCapture({
      maxFrameRate: options.maxFrameRate ?? DEFAULT_MAX_FRAME_RATE,
      videoBitsPerSecond: options.videoBitsPerSecond ?? DEFAULT_VIDEO_BITS_PER_SECOND,
    }),
    mask: new DomCaptureMask(),
    buildArchive: createArchiveStream,
    sink: createReportSink({ streamSaverMitmUrl: options.streamSaverMitmUrl ?? null }),
    flatten: rasterizeAnnotation,
    showClickMarks: () => showClickMarks(clickMarkHost),
    now,
    maxRecordingMs: options.maxRecordingMs ?? DEFAULT_MAX_RECORDING_MS,
    countdownSeconds: options.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS,
  });
}
