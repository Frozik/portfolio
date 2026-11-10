import type { Temporal } from 'temporal-polyfill';

export type TDiagnosticsLevel = 'debug' | 'info' | 'warn' | 'error';

export type TDiagnosticsCategory =
  | 'sync'
  | 'ics'
  | 'calendar'
  | 'ruleset'
  | 'screening'
  | 'conflict'
  | 'permissions'
  | 'background'
  | 'sms'
  | 'app';

export interface IDiagnosticsEntry {
  readonly at: Temporal.Instant;
  readonly level: TDiagnosticsLevel;
  readonly category: string;
  readonly event: string;
  readonly fields: Readonly<Record<string, string>>;
}
