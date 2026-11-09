import type { Temporal } from 'temporal-polyfill';

import type { IDiagnosticsEntry } from './diagnostics-entry';

export interface IExportHeader {
  readonly appVersion: string;
  readonly androidVersion: string;
  readonly device: string;
  readonly facts: Readonly<Record<string, string>>;
}

/** The file «Share» sends: a header of what the phone is, then one entry a line, newest first. */
export function diagnosticsFile(
  header: IExportHeader,
  entries: readonly IDiagnosticsEntry[],
  at: Temporal.Instant
) {
  const lines = [
    `Calls Filter diagnostics ${at.toString()}`,
    `app ${header.appVersion} · Android ${header.androidVersion} · ${header.device}`,
    ...Object.entries(header.facts).map(([key, value]) => `${key}: ${value}`),
    '',
    ...entries.map(entry => {
      const fields = Object.entries(entry.fields)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');
      return `${entry.at.toString()} ${entry.level.toUpperCase()} ${entry.category} ${entry.event}${fields === '' ? '' : ` ${fields}`}`;
    }),
  ];
  return {
    name: `calls-filter-diagnostics-${at.toString().slice(0, 10)}.txt`,
    mime: 'text/plain',
    text: `${lines.join('\n')}\n`,
  };
}
