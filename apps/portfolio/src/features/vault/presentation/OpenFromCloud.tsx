import type { TStoragePath } from '@frozik/cloud-storage/core/storage-provider';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { useEventCallback } from 'usehooks-ts';

import { Alert } from '@frozik/components/ui/Alert';
import { CardFrame } from '@frozik/components/ui/CardFrame';
import { Spinner } from '@frozik/components/ui/Spinner';
import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';
import { adoptFailureText } from '@frozik/vault-app/texts/cloud/cloud-wording';
import { CloudPanels } from '@frozik/vault-react/cloud/CloudPanels';
import { cloudT } from '@frozik/vault-react/texts/cloud';
import { vaultPaths } from './vault-paths';

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
    readonly store: VaultApp;
    readonly onClose: () => void;
    /** The reached folder is empty and the user wants a new vault in it. */
    readonly onCreateHere: () => void;
  }) => {
    const navigate = useNavigate();
    const { cloud } = store;
    const opened = useEventCallback((vaultKey: TVaultKey | null) => {
      if (!isNil(vaultKey)) {
        store.choose(vaultKey);
        void navigate(vaultPaths.vault(vaultKey), { replace: true });
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
          <Alert type="error" message={adoptFailureText(cloudT, cloud.opening.failure)} />
        )}
      </CardFrame>
    );
  }
);
