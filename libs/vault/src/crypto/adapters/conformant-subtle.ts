import { isNil } from 'lodash-es';

/** The algorithms whose failed check the core reads as `OperationError`. */
const CHECKED_ALGORITHMS: ReadonlySet<string> = new Set(['AES-GCM', 'AES-CBC']);

function nameOf(algorithm: AlgorithmIdentifier): string {
  return typeof algorithm === 'string' ? algorithm : algorithm.name;
}

function operationError(cause: unknown): Error {
  const error = new Error('The operation failed for an operation-specific reason', { cause });
  error.name = 'OperationError';
  return error;
}

/** A library's own failure; one it already named the WebCrypto way (a misused key) stays as it is. */
function isUnnamed(error: unknown): boolean {
  return typeof error !== 'object' || isNil(error) || !('name' in error) || error.name === 'Error';
}

async function checked<T>(algorithm: AlgorithmIdentifier, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw CHECKED_ALGORITHMS.has(nameOf(algorithm)) && isUnnamed(error)
      ? operationError(error)
      : error;
  }
}

/**
 * A WebCrypto that fails as the standard says: a native implementation
 * (react-native-quick-crypto) throws its own errors where WebCrypto throws
 * `OperationError` — a wrong key, a changed tag, bad padding — and the core
 * tells a wrong password from a broken file by that name. Every other call
 * passes through unchanged.
 */
export function conformantSubtle(subtle: SubtleCrypto): SubtleCrypto {
  return {
    decrypt: (algorithm, key, data) =>
      checked(algorithm, () => subtle.decrypt(algorithm, key, data)),
    unwrapKey: (
      format,
      wrapped,
      unwrappingKey,
      unwrapAlgorithm,
      unwrappedKeyAlgorithm,
      extractable,
      usages
    ) =>
      checked(unwrapAlgorithm, () =>
        subtle.unwrapKey(
          format,
          wrapped,
          unwrappingKey,
          unwrapAlgorithm,
          unwrappedKeyAlgorithm,
          extractable,
          usages
        )
      ),
    encrypt: (algorithm, key, data) => subtle.encrypt(algorithm, key, data),
    sign: (algorithm, key, data) => subtle.sign(algorithm, key, data),
    verify: (algorithm, key, signature, data) => subtle.verify(algorithm, key, signature, data),
    digest: (algorithm, data) => subtle.digest(algorithm, data),
    generateKey: ((algorithm: AlgorithmIdentifier, extractable: boolean, usages: KeyUsage[]) =>
      subtle.generateKey(algorithm, extractable, usages)) as SubtleCrypto['generateKey'],
    deriveKey: (algorithm, baseKey, derivedKeyType, extractable, usages) =>
      subtle.deriveKey(algorithm, baseKey, derivedKeyType, extractable, usages),
    deriveBits: (algorithm, baseKey, length) => subtle.deriveBits(algorithm, baseKey, length),
    importKey: ((
      format: KeyFormat,
      keyData: BufferSource | JsonWebKey,
      algorithm: AlgorithmIdentifier,
      extractable: boolean,
      usages: KeyUsage[]
    ) =>
      subtle.importKey(
        format as 'raw',
        keyData as BufferSource,
        algorithm,
        extractable,
        usages
      )) as SubtleCrypto['importKey'],
    exportKey: ((format: KeyFormat, key: CryptoKey) =>
      subtle.exportKey(format as 'raw', key)) as SubtleCrypto['exportKey'],
    wrapKey: (format, key, wrappingKey, wrapAlgorithm) =>
      subtle.wrapKey(format, key, wrappingKey, wrapAlgorithm),
  };
}
