import { formatDateTimeLocal } from '@frozik/utils/date/format';
import { millisecondsToISO8601 } from '@frozik/utils/date/iso8601';
import type { IKnownVault } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { memo, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useEventCallback } from 'usehooks-ts';

import { Alert } from '../../../shared/ui/Alert';
import { Button } from '../../../shared/ui/Button';
import { CardFrame } from '../../../shared/ui/CardFrame';
import { MonoKicker } from '../../../shared/ui/MonoKicker';
import { Spinner } from '../../../shared/ui/Spinner';
import { DEMO_VAULT_PASSWORD } from '../domain/demo-vault';
import { vaultPaths } from '../domain/vault-paths';
import { CreateVaultPanel } from './create/CreateVaultPanel';
import { OpenFromCloud } from './OpenFromCloud';
import { registryFailureText } from './registry-failure-text';
import { vaultT } from './translations';
import { cloudT } from './translations/cloud';
import { translateTemplateKey } from './translations/template-texts';
import { useVaultOutletStore } from './useVaultOutletStore';

const VaultRow = memo(({ vault }: { readonly vault: IKnownVault }) => (
  <CardFrame hoverable>
    <NavLink
      to={vaultPaths.vault(vault.vaultKey)}
      className="flex flex-col gap-2 px-6 py-5 text-landing-fg no-underline"
    >
      <span className="text-[17px] font-medium">{vault.name}</span>
      <span className="flex flex-wrap gap-3">
        <MonoKicker tone="faint">
          {isNil(vault.lastOpenedAt)
            ? vaultT.deviceVaults.neverOpened
            : vaultT.deviceVaults.lastOpened(
                formatDateTimeLocal(millisecondsToISO8601(vault.lastOpenedAt))
              )}
        </MonoKicker>
        {vault.unsyncedChanges && <MonoKicker>{vaultT.deviceVaults.unsynced}</MonoKicker>}
      </span>
    </NavLink>
  </CardFrame>
));

const StartActions = observer(() => {
  const store = useVaultOutletStore();
  const navigate = useNavigate();
  const [startedHere, setStartedHere] = useState(false);
  const [fromCloud, setFromCloud] = useState(false);
  const closeFromCloud = useEventCallback(() => {
    store.cloud.closeDriveForm();
    store.cloud.closeWebDavForm();
    setFromCloud(false);
  });
  const { session, createForm } = store;

  useEffect(() => {
    if (startedHere && !isNil(session)) {
      void navigate(vaultPaths.vault(session.vaultKey));
    }
  }, [startedHere, session, navigate]);

  const tryDemo = useEventCallback(() => {
    setStartedHere(true);
    store.startDemo(vaultT.demoVaultName, translateTemplateKey);
  });
  const submitCreate = useEventCallback(() => {
    setStartedHere(true);
    store.submitCreateForm();
  });

  if (store.lifecycle.kind === 'creating') {
    return (
      <p className="flex items-center gap-2 text-[14px] text-landing-fg-dim">
        <Spinner />
        {vaultT.create.creating}
      </p>
    );
  }
  if (fromCloud) {
    return <OpenFromCloud store={store} onClose={closeFromCloud} />;
  }
  if (!isNil(createForm)) {
    return (
      <CreateVaultPanel
        form={createForm}
        onSubmit={submitCreate}
        onCancel={store.closeCreateForm}
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={tryDemo}>
          {vaultT.start.tryDemo}
        </Button>
        <Button type="button" variant="secondary" onClick={store.openCreateForm}>
          {vaultT.start.create}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setFromCloud(true)}>
          {cloudT.opening.open}
        </Button>
      </div>
      <span className="text-[12px] text-landing-fg-faint">
        {vaultT.start.tryDemoHint(DEMO_VAULT_PASSWORD)}
      </span>
    </div>
  );
});

/** The start screen: try the demo, create a vault, or pick one this device knows. */
export const VaultStart = observer(() => {
  const { vaults } = useVaultOutletStore().registry;

  return (
    <section className="flex flex-col gap-4">
      <Alert type="warning" message={vaultT.demoWarning} />
      <StartActions />
      <h2 className="text-[20px] font-medium text-landing-fg">{vaultT.deviceVaults.title}</h2>
      {!isNil(vaults.fail) ? (
        <Alert type="error" message={registryFailureText(vaults.fail)} />
      ) : isNil(vaults.value) ? (
        <Spinner />
      ) : vaults.value.length === 0 ? (
        <p className="text-[15px] text-landing-fg-dim">{vaultT.deviceVaults.empty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {vaults.value.map(vault => (
            <VaultRow key={vault.vaultKey} vault={vault} />
          ))}
        </div>
      )}
    </section>
  );
});
