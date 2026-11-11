import type { Temporal } from 'temporal-polyfill';

export type TDiagnosticsLevel = 'info' | 'warn' | 'error';

export const DIAGNOSTICS_CATEGORIES = ['app', 'unlock', 'lock', 'sync', 'cloud'] as const;

export type TDiagnosticsCategory = (typeof DIAGNOSTICS_CATEGORIES)[number];

/**
 * What happened, in the app's own codes: fields hold kinds, reasons and counts, never a vault's
 * contents, names, addresses or anything typed — the log is copied to whoever helps.
 */
export interface IDiagnosticsNote {
  readonly level: TDiagnosticsLevel;
  readonly category: TDiagnosticsCategory;
  readonly event: string;
  readonly fields: Readonly<Record<string, string>>;
}

export interface IDiagnosticsEntry extends IDiagnosticsNote {
  readonly at: Temporal.Instant;
}
