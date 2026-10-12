import { isNil } from 'lodash-es';
import type { Plugin } from 'vite';

const KDBXWEB_MODULE = /[\\/]kdbxweb[\\/]/;
const EMPTY_CRYPTO_ID = '\0kdbxweb-node-crypto';

/**
 * kdbxweb's UMD build requires Node's `crypto` for the branch it takes only
 * when `globalThis.crypto.subtle` is missing — never in a browser or a worker.
 * An explicit empty module replaces Vite's implicit browser stub, so the build
 * stops warning about the externalized import; nothing else's `crypto` changes.
 */
export function kdbxWithoutNodeCrypto(): Plugin {
  return {
    name: 'kdbx-without-node-crypto',
    enforce: 'pre',
    resolveId(source, importer) {
      return source === 'crypto' && !isNil(importer) && KDBXWEB_MODULE.test(importer)
        ? EMPTY_CRYPTO_ID
        : null;
    },
    load(id) {
      return id === EMPTY_CRYPTO_ID ? 'export default {};' : null;
    },
  };
}
