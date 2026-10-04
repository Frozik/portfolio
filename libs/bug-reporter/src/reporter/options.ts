import type { IDiagnosticsLimits } from '../collectors/diagnostics';
import type { TNow } from '../core/clock';

export interface IBugReporterOptions {
  /** The page's own root: click marks during a recording are painted inside it, not over the reporter's UI. */
  readonly appRoot: Element | null;
  readonly maxRecordingMs: number;
  readonly videoBitsPerSecond: number;
  readonly maxFrameRate: number;
  readonly countdownSeconds: number;
  /** Same-origin URL of StreamSaver's `mitm.html`; `null` skips the StreamSaver tier. */
  readonly streamSaverMitmUrl: string | null;
  readonly limits: Partial<IDiagnosticsLimits>;
  readonly now: TNow;
}

const MINUTE_MS = 60_000;
const MEGABIT = 1_000_000;

export const DEFAULT_MAX_RECORDING_MS = 3 * MINUTE_MS;
export const DEFAULT_VIDEO_BITS_PER_SECOND = 2.5 * MEGABIT;
export const DEFAULT_MAX_FRAME_RATE = 30;
export const DEFAULT_COUNTDOWN_SECONDS = 3;
