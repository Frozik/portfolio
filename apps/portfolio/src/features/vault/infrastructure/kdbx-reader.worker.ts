import { HASH_WASM_KDBX_ARGON2 } from '@frozik/vault/import/kdbx/adapters/kdbx-argon2-hash-wasm';
import { readKdbx } from '@frozik/vault/import/kdbx/read-kdbx';

import type { TReadKdbx } from '../domain/ports/kdbx-reader';

/** One KeePass file per Worker: Argon2 and the XML off the main thread; the Worker ends with the answer. */
self.addEventListener('message', (event: MessageEvent<Parameters<TReadKdbx>>) => {
  void readKdbx(...event.data, HASH_WASM_KDBX_ARGON2).then(result => self.postMessage(result));
});
