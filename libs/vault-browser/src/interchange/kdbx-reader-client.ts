import { err } from '@frozik/utils/result/result';
import { createRpcClient } from '@frozik/utils/worker/rpc-client';

import type { TReadKdbx } from '@frozik/vault-app/interchange/domain/ports/kdbx-reader';
import type { TKdbxReaderContract } from './kdbx-reader.worker';

/** A Worker per file, ended once it answers: kdbxweb and its XML parser load only when a KeePass file is chosen. */
export const readKdbxInWorker: TReadKdbx = async (file, credentials) => {
  const client = createRpcClient<TKdbxReaderContract>(
    new Worker(new URL('./kdbx-reader.worker.ts', import.meta.url), { type: 'module' })
  );
  const read = await client.call('read', { file, credentials });
  client.dispose();
  return read.ok ? read.value : err('unreadable');
};
