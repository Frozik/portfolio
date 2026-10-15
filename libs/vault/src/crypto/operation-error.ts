import { isNil } from 'lodash-es';

/**
 * WebCrypto reports a failed tag check as a `DOMException` named
 * `OperationError`. Matched by name alone: Node's WebCrypto throws its own
 * `DOMException`, which fails `instanceof` against a test DOM's or a jest
 * VM's globals, and Hermes has no `DOMException` at all.
 */
export function isOperationError(error: unknown): boolean {
  return (
    typeof error === 'object' && !isNil(error) && 'name' in error && error.name === 'OperationError'
  );
}
