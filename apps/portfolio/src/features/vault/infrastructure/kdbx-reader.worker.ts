import { serveRpc } from '@frozik/utils/worker/rpc-server';
import { HASH_WASM_KDBX_ARGON2 } from '@frozik/vault/import/kdbx/adapters/kdbx-argon2-hash-wasm';
import { readKdbx } from '@frozik/vault/import/kdbx/read-kdbx';

import type { TReadKdbx } from '../domain/ports/kdbx-reader';

export type TKdbxReaderContract = {
  readonly read: {
    readonly request: {
      readonly file: Parameters<TReadKdbx>[0];
      readonly credentials: Parameters<TReadKdbx>[1];
    };
    readonly response: Awaited<ReturnType<TReadKdbx>>;
  };
};

/** One KeePass file per Worker: Argon2 and the XML off the main thread. */
serveRpc<TKdbxReaderContract>(self, {
  read: { handle: ({ file, credentials }) => readKdbx(file, credentials, HASH_WASM_KDBX_ARGON2) },
});
