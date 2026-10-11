import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import { isNil } from 'lodash-es';
import { reaction } from 'mobx';

import { LOCAL_COPY_PATH } from '../domain/local-copy';
import type { CloudLink } from './CloudLink';
import type { IOpenedSession, IVaultSessionServices } from './vault-session-inputs';
import { VaultFiles } from './VaultFiles';

/** What the session's files read of it. */
interface IFilesSession {
  readonly document: IVaultDocument;
  readonly cloud: CloudLink;
}

/** The session's big files, beside its local copy and, for the tab that syncs, its cloud file. */
export function createSessionFiles(
  session: IFilesSession,
  {
    services,
    opened,
    signal,
  }: {
    readonly services: IVaultSessionServices;
    readonly opened: IOpenedSession;
    readonly signal: AbortSignal;
  }
): VaultFiles {
  return new VaultFiles({
    document: () => session.document,
    localCopy: services.localCopyOf(opened.vaultKey),
    localPath: LOCAL_COPY_PATH,
    cloud: () => {
      const { connection, leader } = session.cloud;
      return leader && !isNil(connection)
        ? { storage: connection.storage, path: connection.location.path }
        : null;
    },
    random: services.random,
    signal,
    openedCopyModifiedAt: opened.localModifiedAt,
    now: services.clock.now,
  });
}

/**
 * At unlock this device's leftovers go; after every cloud
 * sync the blobs reach the cloud and the ones not found before are looked
 * for again. Started once the session is observable.
 */
export function followCloudSyncs(session: IFilesSession, files: VaultFiles): () => void {
  void files.removeGone();
  return reaction(
    () => (session.cloud.status.kind === 'synced' ? session.document.assets : null),
    assets => {
      if (!isNil(assets)) {
        void files.uploadMissing();
        files.retryMissing();
      }
    },
    { fireImmediately: true }
  );
}
