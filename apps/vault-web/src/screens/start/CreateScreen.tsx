import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { Spinner } from '@frozik/components/ui/Spinner';
import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';
import { CreateVaultPanel } from '@frozik/vault-react/create/CreateVaultPanel';
import { cloudT } from '@frozik/vault-react/texts/cloud';
import { vaultT } from '@frozik/vault-react/texts/vault';
import { ScreenFrame } from '../frame/ScreenFrame';
import { paths } from '../paths';
import { useLeaveOpenVault } from './useLeaveOpenVault';
import { useOpenWhenStarted } from './useOpenWhenStarted';
import { useStepBack } from './useStepBack';

/** A new vault: on this device only, or in the cloud folder the opening reached. */
export const CreateScreen = observer(
  ({ app, inCloud }: { readonly app: VaultApp; readonly inCloud: boolean }) => {
    const leave = useStepBack(inCloud ? paths.openFromCloud() : paths.start());
    const [started, setStarted] = useState(false);
    useOpenWhenStarted(app, started);
    useLeaveOpenVault(app);
    useEffect(() => {
      app.openCreateForm();
      return app.closeCreateForm;
    }, [app]);
    const { createForm } = app;
    const submit = useEventCallback(() => {
      if (inCloud && !isNil(createForm)) {
        app.cloud.prepareNewVaultHere(createForm.name.trim());
      }
      setStarted(true);
      app.submitCreateForm();
    });

    if (app.lifecycle.kind === 'creating') {
      return (
        <ScreenFrame className="items-center justify-center">
          <div className="flex items-center gap-2 text-[15px] text-fg-dim" role="status">
            <Spinner />
            {vaultT.create.creating}
          </div>
        </ScreenFrame>
      );
    }
    return (
      <ScreenFrame>
        {isNil(createForm) ? (
          <Spinner />
        ) : (
          <CreateVaultPanel
            form={createForm}
            note={inCloud ? cloudT.section.createdHere : undefined}
            onSubmit={submit}
            onCancel={leave}
          />
        )}
      </ScreenFrame>
    );
  }
);
