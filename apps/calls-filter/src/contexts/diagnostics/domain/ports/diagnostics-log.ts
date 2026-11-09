import type {
  IDiagnosticsEntry,
  TDiagnosticsCategory,
  TDiagnosticsLevel,
} from '../diagnostics-entry';

/** The one diagnostics log of the phone; the service redacts every entry before it keeps it. */
export interface IDiagnosticsLog {
  log(
    level: TDiagnosticsLevel,
    category: TDiagnosticsCategory,
    event: string,
    fields?: Readonly<Record<string, string>>
  ): void;
  latest(limit: number): readonly IDiagnosticsEntry[];
}
