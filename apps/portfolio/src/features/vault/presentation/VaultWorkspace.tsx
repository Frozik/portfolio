import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { useEventCallback } from 'usehooks-ts';

import { useRegisterTopNavBack } from '../../../app/components/TopNavBackContext';
import { Alert } from '../../../shared/ui/Alert';
import { Spinner } from '../../../shared/ui/Spinner';
import { parseVaultPage, vaultPaths } from '../domain/vault-paths';
import { AuditPage } from './audit/AuditPage';
import { ForeignVaultDialog } from './layout/ForeignVaultDialog';
import { VaultLayout } from './layout/VaultLayout';
import { registryFailureText } from './registry-failure-text';
import { CloudSection } from './settings/CloudSection';
import { DataSection } from './settings/DataSection';
import { PasskeysSection } from './settings/PasskeysSection';
import { RecoveryKeyPanel } from './settings/RecoveryKeyPanel';
import { VaultSettings } from './settings/VaultSettings';
import { vaultT } from './translations';
import { VaultUnlock } from './unlock/VaultUnlock';
import { useVaultOutletStore } from './useVaultOutletStore';

/** `/vault/:vaultId/*`: the URL picks the vault; an address it cannot serve says so, never redirects. */
export const VaultWorkspace = observer(() => {
  const { vaultId = '', '*': splat = '' } = useParams<{ vaultId: TVaultKey; '*': string }>();
  const store = useVaultOutletStore();
  const { vaults } = store.registry;
  const lockManually = useEventCallback(() => store.lock('manual'));
  const navigate = useNavigate();
  const forget = useEventCallback(() => {
    void navigate(vaultPaths.start());
    void store.forgetVault();
  });

  const toVaults = useEventCallback(() => void navigate(vaultPaths.start()));
  useRegisterTopNavBack({ label: vaultT.backToVaults, onActivate: toVaults });

  useEffect(() => {
    if (!isNil(store.session) && store.session.vaultKey !== vaultId) {
      store.lock('route-left');
    }
    store.choose(vaultId);
  }, [store, vaultId]);

  if (!isNil(vaults.fail)) {
    return <Alert type="error" message={registryFailureText(vaults.fail)} />;
  }
  if (isNil(vaults.value)) {
    return <Spinner />;
  }

  const vault = vaults.value.find(known => known.vaultKey === vaultId);
  const page = parseVaultPage(splat);
  if (isNil(vault) || page.kind === 'unknown') {
    return (
      <section className="flex flex-col items-start gap-4">
        <Alert
          type="warning"
          message={isNil(vault) ? vaultT.notFound.vault : vaultT.notFound.page}
        />
        <NavLink to={vaultPaths.start()} className="text-[15px] text-landing-fg underline">
          {vaultT.notFound.back}
        </NavLink>
      </section>
    );
  }

  const { lifecycle, session } = store;
  if (!isNil(session) && session.vaultKey === vaultId) {
    if (page.kind === 'settings') {
      return (
        <VaultSettings
          session={session}
          backTo={vaultPaths.vault(session.vaultKey)}
          cloud={<CloudSection store={store} session={session} />}
          data={<DataSection store={store} session={session} />}
          recovery={
            <>
              <RecoveryKeyPanel store={store} session={session} />
              <PasskeysSection store={store} session={session} />
            </>
          }
          onRename={name => void store.renameVault(name)}
          onForget={forget}
        />
      );
    }
    return page.kind === 'audit' ? (
      <AuditPage session={session} />
    ) : (
      <>
        <VaultLayout session={session} page={page} onLock={lockManually} />
        <ForeignVaultDialog
          session={session}
          onDisconnect={() => void store.cloud.disconnect(session)}
        />
      </>
    );
  }
  if (
    (lifecycle.kind === 'locked' || lifecycle.kind === 'unlocking') &&
    lifecycle.vaultKey === vaultId
  ) {
    return (
      <VaultUnlock
        store={store}
        vault={vault}
        unlocking={lifecycle.kind === 'unlocking'}
        failure={lifecycle.kind === 'locked' ? lifecycle.failure : null}
      />
    );
  }
  return <Spinner />;
});
