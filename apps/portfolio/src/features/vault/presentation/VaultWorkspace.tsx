import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { useEventCallback } from 'usehooks-ts';

import { Alert } from '@frozik/components/ui/Alert';
import { Spinner } from '@frozik/components/ui/Spinner';
import { parseVaultPage } from '@frozik/vault-app/navigation/vault-paths';
import { storageFailureText } from '@frozik/vault-app/texts/vault/storage-failure-wording';
import { AuditPage } from '@frozik/vault-react/audit/AuditPage';
import { ForeignVaultDialog } from '@frozik/vault-react/session/ForeignVaultDialog';
import { CloudSection } from '@frozik/vault-react/settings/CloudSection';
import { DataSection } from '@frozik/vault-react/settings/DataSection';
import { PasskeysSection } from '@frozik/vault-react/settings/PasskeysSection';
import { QuickUnlockPanel } from '@frozik/vault-react/settings/QuickUnlockPanel';
import { RecoveryKeyPanel } from '@frozik/vault-react/settings/RecoveryKeyPanel';
import { vaultT } from '@frozik/vault-react/texts/vault';
import { QuickUnlockScreen } from '@frozik/vault-react/unlock/QuickUnlockScreen';
import { useRegisterTopNavBack } from '../../../app/components/TopNavBackContext';
import { ReminderDialog } from './layout/ReminderDialog';
import { VaultLayout } from './layout/VaultLayout';
import { VaultSettings } from './settings/VaultSettings';
import { VaultUnlock } from './unlock/VaultUnlock';
import { useVaultOutletStore } from './useVaultOutletStore';
import { vaultPaths } from './vault-paths';

/** Where the vault opens, printed on an Emergency Kit. */
const VAULT_ADDRESS = `${window.location.origin}${import.meta.env.BASE_URL}vault`;

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
  /** At a quick lock the user may skip the code for the master password; a new lock asks again. */
  const [useMaster, setUseMaster] = useState(false);
  useEffect(() => {
    if (store.lifecycle.kind === 'unlocked') {
      setUseMaster(false);
    }
  }, [store.lifecycle.kind]);
  useRegisterTopNavBack({ label: vaultT.backToVaults, onActivate: toVaults });

  useEffect(() => {
    if (!isNil(store.session) && store.session.vaultKey !== vaultId) {
      store.lock('left');
    }
    store.choose(vaultId);
    // A lock asked here may finish later (a draft is saved first): the choice is made again then.
  }, [store, vaultId, store.lifecycle.kind]);

  if (!isNil(vaults.fail)) {
    return <Alert type="error" message={storageFailureText(vaultT, vaults.fail)} />;
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
          data={<DataSection session={session} />}
          recovery={
            <>
              <RecoveryKeyPanel session={session} siteAddress={VAULT_ADDRESS} />
              <PasskeysSection session={session} />
              <QuickUnlockPanel create={() => session.flows.quickUnlockOf()} />
            </>
          }
          onRename={title => void store.renameVault(title)}
          onForget={forget}
        />
      );
    }
    return page.kind === 'audit' ? (
      <AuditPage session={session} paths={vaultPaths} />
    ) : (
      <>
        <VaultLayout session={session} page={page} onLock={lockManually} />
        <ForeignVaultDialog
          session={session}
          onDisconnect={() => void store.cloud.disconnect(session)}
        />
        <ReminderDialog reminder={session.reminder} />
      </>
    );
  }
  if (
    (lifecycle.kind === 'locked' || lifecycle.kind === 'unlocking') &&
    lifecycle.vaultKey === vaultId
  ) {
    const quickLocked =
      (lifecycle.kind === 'locked' && lifecycle.level === 'quick') ||
      (lifecycle.kind === 'unlocking' && lifecycle.via === 'quick');
    const { prompt } = store.quick;
    if (quickLocked && !useMaster && !isNil(prompt)) {
      return (
        <QuickUnlockScreen
          vault={vault}
          quick={store.quick}
          prompt={prompt}
          unlocking={lifecycle.kind === 'unlocking'}
          onUseMaster={() => setUseMaster(true)}
          onLockCompletely={() => store.lock('complete')}
        />
      );
    }
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
