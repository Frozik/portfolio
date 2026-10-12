import type { TStoragePath } from '@frozik/cloud-storage/core/storage-provider';
import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { useEventCallback } from 'usehooks-ts';

import { Alert } from '../../../shared/ui/Alert';
import { CardFrame } from '../../../shared/ui/CardFrame';
import { Spinner } from '../../../shared/ui/Spinner';
import type { TAdoptFailure } from '../application/cloud-adoption';
import type { VaultFeatureStore } from '../application/VaultFeatureStore';
import { vaultPaths } from '../domain/vault-paths';
import { CloudPanels } from './settings/CloudPanels';
import { cloudT } from './translations/cloud';

function failureText(failure: TAdoptFailure): string {
  const t = cloudT.opening;
  switch (failure.kind) {
    case 'storage':
      return failure.error.kind === 'server'
        ? cloudT.webdav.failures.server(failure.error.status)
        : cloudT.webdav.failures[failure.error.kind];
    case 'not-found':
      return t.notFound;
    case 'not-a-vault':
      return t.notAVault;
    case 'device':
      return t.device;
    default:
      return assertNever(failure);
  }
}

/**
 * Sign in to Drive or
 * check a WebDAV folder, pick a vault found there; it is downloaded to this
 * device and the usual unlock opens it.
 */
export const OpenFromCloud = observer(
  ({
    store,
    onClose,
    onCreateHere,
  }: {
    readonly store: VaultFeatureStore;
    readonly onClose: () => void;
    /** The reached folder is empty and the user wants a new vault in it. */
    readonly onCreateHere: () => void;
  }) => {
    const navigate = useNavigate();
    const { cloud } = store;
    const opened = useEventCallback((vaultKey: TVaultKey | null) => {
      if (!isNil(vaultKey)) {
        store.choose(vaultKey);
        void navigate(vaultPaths.vault(vaultKey));
      }
    });
    const openFromDrive = useEventCallback(
      (path: TStoragePath) => void cloud.openFromDrive(path).then(opened)
    );
    const openFromWebDav = useEventCallback(
      (path: TStoragePath) => void cloud.openFromWebDav(path).then(opened)
    );

    return (
      <CardFrame className="flex flex-col gap-4 p-6">
        <h2 className="text-[20px] font-medium text-landing-fg">{cloudT.opening.title}</h2>
        <p className="text-[13px] text-landing-fg-dim">{cloudT.opening.intro}</p>
        <CloudPanels
          cloud={cloud}
          driveAction={{ kind: 'open', onOpen: openFromDrive, onCreate: onCreateHere }}
          webDavAction={{ kind: 'open', onOpen: openFromWebDav, onCreate: onCreateHere }}
          onClose={onClose}
        />
        {cloud.opening.kind === 'opening' && <Spinner />}
        {cloud.opening.kind === 'failed' && (
          <Alert type="error" message={failureText(cloud.opening.failure)} />
        )}
      </CardFrame>
    );
  }
);
