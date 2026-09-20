/**
 * Sends a failure to the browser console.
 *
 * Failures usually end up in a state — a fail descriptor, an `unsupported`
 * branch, a disabled feature — that the UI renders as a short message and the
 * next successful update overwrites. Without this the cause is on screen for a
 * moment and then unrecoverable, so every place that turns an error into state
 * reports it here first. One place to route elsewhere later.
 */
export function reportError(context: string, error: unknown): void {
  // oxlint-disable-next-line no-console -- the single sink every swallowed failure is routed through
  console.error(`${context}:`, error);
}
