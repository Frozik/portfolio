/**
 * WebCrypto reports a failed tag check as a `DOMException` named
 * `OperationError`. Matched by name: Node's WebCrypto throws its own
 * `DOMException` class, which fails `instanceof` against a test DOM's global.
 */
export function isOperationError(error: unknown): boolean {
  return error instanceof Error && error.name === 'OperationError';
}
