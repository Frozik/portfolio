import type { Temporal } from 'temporal-polyfill';

import type { IDiagnosticsEntry } from './diagnostics-entry';

/** What the copy names beside the entries: the build and the device it runs on. */
export interface IDiagnosticsHeader {
  readonly app: string;
  readonly platform: string;
}

export function diagnosticsLine(entry: IDiagnosticsEntry): string {
  const fields = Object.entries(entry.fields)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');
  return [entry.at.toString(), entry.level.toUpperCase(), entry.category, entry.event, fields]
    .filter(part => part !== '')
    .join(' ');
}

/** The copied log: what runs where, then one entry a line, newest first. */
export function diagnosticsText(
  header: IDiagnosticsHeader,
  entries: readonly IDiagnosticsEntry[],
  at: Temporal.Instant
): string {
  return `${[`${header.app} diagnostics ${at.toString()}`, header.platform, '', ...entries.map(diagnosticsLine)].join('\n')}\n`;
}
