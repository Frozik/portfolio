import type { TResult } from '@frozik/utils/result/result';
import { err } from '@frozik/utils/result/result';
import type { IImportBatch } from '@frozik/vault/import/imported-card';
import type { TKdbxError } from '@frozik/vault/import/kdbx/read-kdbx';

import type { TReadKdbx } from '../domain/ports/kdbx-reader';

/** A Worker per file, ended once it answers: kdbxweb and its XML parser load only when a KeePass file is chosen. */
export const readKdbxInWorker: TReadKdbx = (file, credentials) =>
  new Promise(resolve => {
    const worker = new Worker(new URL('./kdbx-reader.worker.ts', import.meta.url), {
      type: 'module',
    });
    const finish = (result: TResult<IImportBatch, TKdbxError>): void => {
      worker.terminate();
      resolve(result);
    };
    worker.addEventListener('message', (event: MessageEvent<TResult<IImportBatch, TKdbxError>>) =>
      finish(event.data)
    );
    worker.addEventListener('error', () => finish(err('unreadable')));
    worker.postMessage([file, credentials] satisfies Parameters<TReadKdbx>);
  });
