import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { useIsFocused } from 'expo-router';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { storageFailureText } from '@frozik/vault-app/texts/vault/storage-failure-wording';

import { useAppModel } from '../app-model';
import { Busy } from '../kit/Busy';
import { Button } from '../kit/Button';
import { Notice } from '../kit/Notice';
import { Screen } from '../kit/Screen';
import { useVaultTexts } from '../texts';
import { QuickUnlockScreen } from '../unlock/QuickUnlockScreen';
import { UnlockScreen } from '../unlock/UnlockScreen';
import { AllVaultsLink } from './AllVaultsLink';
import { OpenVault } from './OpenVault';

/** `/:vaultId`: the address picks the vault; one it cannot serve says so, never redirects. */
export const VaultScreen = observer(function VaultScreen({
  vaultKey,
  children,
}: {
  readonly vaultKey: TVaultKey;
  /** The open vault's pages. */
  readonly children: ReactNode;
}) {
  const { app } = useAppModel();
  const t = useVaultTexts();
  /** At a quick lock the user may skip the code for the master password; a new lock asks again. */
  const [useMaster, setUseMaster] = useState(false);
  const { lifecycle, session } = app;
  const { vaults } = app.registry;

  useEffect(() => {
    if (lifecycle.kind === 'unlocked') {
      setUseMaster(false);
    }
  }, [lifecycle.kind]);
  /** Only the screen in sight picks the vault: one left below in the stack must not take it back. */
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) {
      return;
    }
    if (!isNil(app.session) && app.session.vaultKey !== vaultKey) {
      app.lock('left');
    }
    app.choose(vaultKey);
  }, [app, vaultKey, lifecycle.kind, focused]);

  if (!isNil(vaults.fail)) {
    return (
      <Screen title={t.deviceVaults.title} testID="vault-unavailable" back={<AllVaultsLink />}>
        <Notice tone="error" message={storageFailureText(t, vaults.fail)} />
        <Button
          testID="vault-retry"
          variant="secondary"
          label={t.phone.retry}
          onPress={() => void app.registry.refresh()}
        />
      </Screen>
    );
  }
  const vault = vaults.value?.find(known => known.vaultKey === vaultKey);
  if (isNil(vaults.value)) {
    return (
      <Screen title={t.deviceVaults.title} testID="vault-loading" back={<AllVaultsLink />}>
        <Busy label={t.deviceVaults.title} />
      </Screen>
    );
  }
  if (isNil(vault)) {
    return (
      <Screen title={t.deviceVaults.title} testID="vault-not-found" back={<AllVaultsLink />}>
        <Notice tone="caution" message={t.notFound.vault} />
      </Screen>
    );
  }
  if (!isNil(session) && session.vaultKey === vaultKey) {
    return <OpenVault session={session}>{children}</OpenVault>;
  }
  if (
    (lifecycle.kind === 'locked' || lifecycle.kind === 'unlocking') &&
    lifecycle.vaultKey === vaultKey
  ) {
    const quickLocked =
      (lifecycle.kind === 'locked' && lifecycle.level === 'quick') ||
      (lifecycle.kind === 'unlocking' && lifecycle.via === 'quick');
    const { prompt } = app.quick;
    if (quickLocked && !useMaster && !isNil(prompt)) {
      return (
        <QuickUnlockScreen
          vault={vault}
          quick={app.quick}
          prompt={prompt}
          unlocking={lifecycle.kind === 'unlocking'}
          onUseMaster={() => setUseMaster(true)}
          onLockCompletely={() => app.lock('complete')}
        />
      );
    }
    return (
      <UnlockScreen
        vault={vault}
        unlocking={lifecycle.kind === 'unlocking'}
        failure={lifecycle.kind === 'locked' ? lifecycle.failure : null}
        onUseQuick={quickLocked && useMaster && !isNil(prompt) ? () => setUseMaster(false) : null}
      />
    );
  }
  return (
    <Screen title={vault.name} testID="vault-loading" back={<AllVaultsLink />}>
      <Busy label={vault.name} />
    </Screen>
  );
});
