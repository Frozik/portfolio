import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { Alert } from '@frozik/components/ui/Alert';
import { Spinner } from '@frozik/components/ui/Spinner';
import { parseVaultPage } from '@frozik/vault-app/navigation/vault-paths';
import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';
import { storageFailureText } from '@frozik/vault-app/texts/vault/storage-failure-wording';
import { vaultT } from '@frozik/vault-react/texts/vault';
import { QuickUnlockScreen } from '@frozik/vault-react/unlock/QuickUnlockScreen';
import { ScreenFrame } from '../frame/ScreenFrame';
import { OpenVault } from '../lazy-screens';
import { paths } from '../paths';
import { AllVaultsLink } from '../unlock/AllVaultsLink';
import { UnlockScreen } from '../unlock/UnlockScreen';

/** `/:vaultId/*`: the address picks the vault; one it cannot serve says so, never redirects. */
export const VaultScreen = observer(
  ({ app, version }: { readonly app: VaultApp; readonly version: string }) => {
    const { vaultId = '', '*': splat = '' } = useParams<{ vaultId: TVaultKey; '*': string }>();
    /** At a quick lock the user may skip the code for the master password; a new lock asks again. */
    const [useMaster, setUseMaster] = useState(false);
    const { lifecycle, session } = app;
    const { vaults } = app.registry;

    useEffect(() => {
      if (lifecycle.kind === 'unlocked') {
        setUseMaster(false);
      }
    }, [lifecycle.kind]);
    useEffect(() => {
      if (!isNil(app.session) && app.session.vaultKey !== vaultId) {
        app.lock('left');
      }
      app.choose(vaultId);
      // A lock asked here may finish later (a draft is saved first): the choice is made again then.
    }, [app, vaultId, lifecycle.kind]);

    if (!isNil(vaults.fail)) {
      return (
        <ScreenFrame>
          <Alert type="error" message={storageFailureText(vaultT, vaults.fail)} />
        </ScreenFrame>
      );
    }
    if (isNil(vaults.value)) {
      return <Spinner />;
    }
    const vault = vaults.value.find(known => known.vaultKey === vaultId);
    const page = parseVaultPage(splat);
    if (isNil(vault) || page.kind === 'unknown') {
      return (
        <ScreenFrame>
          <Alert
            type="warning"
            message={isNil(vault) ? vaultT.notFound.vault : vaultT.notFound.page}
          />
          <Link to={paths.start()} className="text-[15px] text-fg underline">
            {vaultT.notFound.back}
          </Link>
        </ScreenFrame>
      );
    }
    if (!isNil(session) && session.vaultKey === vaultId) {
      return <OpenVault app={app} session={session} page={page} version={version} />;
    }
    if (
      (lifecycle.kind === 'locked' || lifecycle.kind === 'unlocking') &&
      lifecycle.vaultKey === vaultId
    ) {
      const quickLocked =
        (lifecycle.kind === 'locked' && lifecycle.level === 'quick') ||
        (lifecycle.kind === 'unlocking' && lifecycle.via === 'quick');
      const { prompt } = app.quick;
      if (quickLocked && !useMaster && !isNil(prompt)) {
        return (
          <ScreenFrame className="items-center justify-center" header={<AllVaultsLink />}>
            <QuickUnlockScreen
              vault={vault}
              quick={app.quick}
              prompt={prompt}
              unlocking={lifecycle.kind === 'unlocking'}
              onUseMaster={() => setUseMaster(true)}
              onLockCompletely={() => app.lock('complete')}
            />
          </ScreenFrame>
        );
      }
      return (
        <UnlockScreen
          app={app}
          vault={vault}
          unlocking={lifecycle.kind === 'unlocking'}
          failure={lifecycle.kind === 'locked' ? lifecycle.failure : null}
        />
      );
    }
    return <Spinner />;
  }
);
