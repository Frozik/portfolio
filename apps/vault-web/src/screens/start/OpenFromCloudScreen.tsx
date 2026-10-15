import type { TStoragePath } from '@frozik/cloud-storage/core/storage-provider';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEventCallback } from 'usehooks-ts';

import { Alert } from '@frozik/components/ui/Alert';
import { Spinner } from '@frozik/components/ui/Spinner';
import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';
import { adoptFailureText } from '@frozik/vault-app/texts/cloud/cloud-wording';
import { CloudPanels } from '@frozik/vault-react/cloud/CloudPanels';
import { cloudT } from '@frozik/vault-react/texts/cloud';
import { ScreenFrame } from '../frame/ScreenFrame';
import { paths } from '../paths';
import { useLeaveOpenVault } from './useLeaveOpenVault';
import { STEPPED, useStepBack } from './useStepBack';

/**
 * The first screen of a second device: sign in to Drive or reach a WebDAV
 * folder, pick the vault found there; it is copied to this device and the
 * usual unlock opens it.
 */
export const OpenFromCloudScreen = observer(({ app }: { readonly app: VaultApp }) => {
  const navigate = useNavigate();
  const leave = useStepBack(paths.start());
  const { cloud } = app;
  useLeaveOpenVault(app);
  useEffect(
    () => () => {
      cloud.closeDriveForm();
      cloud.closeWebDavForm();
    },
    [cloud]
  );
  const opened = useEventCallback((vaultKey: TVaultKey | null) => {
    if (!isNil(vaultKey)) {
      app.choose(vaultKey);
      void navigate(paths.vault(vaultKey), { replace: true });
    }
  });
  const openFromDrive = useEventCallback(
    (path: TStoragePath) => void cloud.openFromDrive(path).then(opened)
  );
  const openFromWebDav = useEventCallback(
    (path: TStoragePath) => void cloud.openFromWebDav(path).then(opened)
  );
  const createHere = useEventCallback(
    () => void navigate(paths.createInCloud(), { state: STEPPED })
  );

  return (
    <ScreenFrame>
      <h1 className="text-[22px] font-semibold text-fg">{cloudT.opening.title}</h1>
      <p className="text-[14px] text-fg-dim">{cloudT.opening.intro}</p>
      <CloudPanels
        cloud={cloud}
        driveAction={{ kind: 'open', onOpen: openFromDrive, onCreate: createHere }}
        webDavAction={{ kind: 'open', onOpen: openFromWebDav, onCreate: createHere }}
        onClose={leave}
      />
      {cloud.opening.kind === 'opening' && <Spinner />}
      {cloud.opening.kind === 'failed' && (
        <Alert type="error" message={adoptFailureText(cloudT, cloud.opening.failure)} />
      )}
    </ScreenFrame>
  );
});
