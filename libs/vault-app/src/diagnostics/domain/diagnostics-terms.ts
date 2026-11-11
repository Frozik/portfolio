/** How many days the log keeps: long enough to describe a problem, short enough to hold little. */
export const DIAGNOSTICS_TERMS = [1, 7, 30] as const;

export type TDiagnosticsTerm = (typeof DIAGNOSTICS_TERMS)[number];

export const DEFAULT_DIAGNOSTICS_TERM: TDiagnosticsTerm = 7;

export function diagnosticsTermOf(days: number): TDiagnosticsTerm | null {
  return DIAGNOSTICS_TERMS.find(term => term === days) ?? null;
}
