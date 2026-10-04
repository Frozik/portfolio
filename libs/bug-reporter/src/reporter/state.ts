import type { IAnnotation } from '../core/annotation';
import type { TSaveStrategy } from '../core/ports';
import type { IDiagnosticsCounts, TAttachment, TIncludedSections } from '../core/report';
import { EMPTY_COUNTS } from '../core/report';

export interface IDraftScreenshot {
  readonly id: string;
  readonly image: Blob;
}

/**
 * What the compose step holds: a screenshot keeps its marks as data and is
 * flattened into pixels only when the archive is built, so confirming the
 * editor costs nothing.
 */
export type TDraftAttachment =
  | (IDraftScreenshot & { readonly kind: 'screenshot'; readonly annotation: IAnnotation })
  | Extract<TAttachment, { kind: 'recording' }>;

export type TCaptureMode = 'screenshot' | 'recording';

export type TReporterPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'choosing' }
  /** The browser is being asked for the tab; the capture bar is up but not yet usable. */
  | { readonly kind: 'arming'; readonly mode: TCaptureMode }
  /** The tab is shared; the person arranges the page and presses the bar's button when ready. */
  | { readonly kind: 'armed'; readonly mode: TCaptureMode }
  | { readonly kind: 'capturing' }
  | { readonly kind: 'annotating'; readonly screenshot: IDraftScreenshot }
  | { readonly kind: 'countdown'; readonly secondsLeft: number }
  | { readonly kind: 'recording'; readonly startedAt: number; readonly maxDurationMs: number }
  | { readonly kind: 'composing' }
  | { readonly kind: 'packaging'; readonly writtenBytes: number }
  | { readonly kind: 'done'; readonly fileName: string };

export type TReporterNotice =
  | 'capture-unsupported'
  | 'capture-denied'
  | 'capture-failed'
  | 'recording-unsupported'
  | 'recording-limit'
  | 'save-failed';

export interface IReporterCapability {
  readonly screenshot: boolean;
  readonly recording: boolean;
  readonly saveStrategy: TSaveStrategy;
}

export interface IReporterState {
  readonly phase: TReporterPhase;
  readonly attachments: readonly TDraftAttachment[];
  readonly comment: string;
  readonly included: TIncludedSections;
  /** What the compose step shows next to each checkbox; refreshed on every entry into the compose step. */
  readonly counts: IDiagnosticsCounts;
  readonly notice: TReporterNotice | null;
  readonly capability: IReporterCapability;
}

export const ALL_SECTIONS_INCLUDED: TIncludedSections = {
  console: true,
  errors: true,
  breadcrumbs: true,
  network: true,
  performance: true,
  environment: true,
};

export function initialReporterState(capability: IReporterCapability): IReporterState {
  return {
    phase: { kind: 'idle' },
    attachments: [],
    comment: '',
    included: ALL_SECTIONS_INCLUDED,
    counts: EMPTY_COUNTS,
    notice: null,
    capability,
  };
}
