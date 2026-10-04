/**
 * Tearing down a stream that has already failed rejects with that same
 * failure, which its first observer has reported; the teardown itself carries
 * nothing new, so it must not surface as an unhandled rejection.
 */
export function settleTeardown(teardown: Promise<unknown>): void {
  teardown.then(
    () => undefined,
    () => undefined
  );
}
