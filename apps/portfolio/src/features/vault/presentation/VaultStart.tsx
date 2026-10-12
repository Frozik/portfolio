import { formatDateTimeLocal } from '@frozik/utils/date/format';
import { millisecondsToISO8601 } from '@frozik/utils/date/iso8601';
import type { IKnownVault } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useEventCallback } from 'usehooks-ts';

import { Alert } from '../../../shared/ui/Alert';
import { Button } from '../../../shared/ui/Button';
import { CardFrame } from '../../../shared/ui/CardFrame';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { MonoKicker } from '../../../shared/ui/MonoKicker';
import { Spinner } from '../../../shared/ui/Spinner';
import { DEMO_VAULT_PASSWORD } from '../domain/demo-vault';
import { vaultPaths } from '../domain/vault-paths';
import { CreateVaultPanel } from './create/CreateVaultPanel';
import { ExtensionOffer } from './ExtensionOffer';
import { OpenFromCloud } from './OpenFromCloud';
import { registryFailureText } from './registry-failure-text';
import { vaultT } from './translations';
import { cloudT } from './translations/cloud';
import { translateTemplateKey } from './translations/template-texts';
import { useVaultOutletStore } from './useVaultOutletStore';

const DELETE_ICON_SIZE = 16;

const VaultRow = memo(
  ({
    vault,
    onDelete,
  }: {
    readonly vault: IKnownVault;
    readonly onDelete: (vault: IKnownVault) => void;
  }) => (
    <CardFrame hoverable className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4"
        aria-label={vaultT.deviceVaults.delete(vault.name)}
        title={vaultT.deviceVaults.delete(vault.name)}
        onClick={() => onDelete(vault)}
      >
        <Trash2 size={DELETE_ICON_SIZE} aria-hidden />
      </Button>
      <NavLink
        to={vaultPaths.vault(vault.vaultKey)}
        className="flex flex-col gap-2 py-5 pr-14 pl-6 text-landing-fg no-underline"
      >
        <span className="text-[17px] font-medium">{vault.name}</span>
        {vault.description !== '' && (
          <span
            className="text-[14px] whitespace-pre-line text-landing-fg-dim"
            data-testid="vault-description"
          >
            {vault.description}
          </span>
        )}
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
  )
);

const StartActions = observer(() => {
  const store = useVaultOutletStore();
  const navigate = useNavigate();
  const [startedHere, setStartedHere] = useState(false);
  const [fromCloud, setFromCloud] = useState(false);
  const [inCloud, setInCloud] = useState(false);
  const closeFromCloud = useEventCallback(() => {
    store.cloud.closeDriveForm();
    store.cloud.closeWebDavForm();
    setFromCloud(false);
  });
  const { session, createForm } = store;
  const createInCloud = useEventCallback(() => {
    setFromCloud(false);
    setInCloud(true);
    store.openCreateForm();
  });
  const cancelCreate = useEventCallback(() => {
    store.closeCreateForm();
    if (inCloud) {
      setInCloud(false);
      closeFromCloud();
    }
  });

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
    if (inCloud && !isNil(createForm)) {
      store.cloud.prepareNewVaultHere(createForm.name.trim());
    }
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
    return <OpenFromCloud store={store} onClose={closeFromCloud} onCreateHere={createInCloud} />;
  }
  if (!isNil(createForm)) {
    return (
      <CreateVaultPanel
        form={createForm}
        note={inCloud ? cloudT.section.createdHere : undefined}
        onSubmit={submitCreate}
        onCancel={cancelCreate}
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
  const store = useVaultOutletStore();
  const { vaults } = store.registry;
  const [deleting, setDeleting] = useState<IKnownVault | null>(null);

  return (
    <section className="flex flex-col gap-4">
      <Alert type="warning" message={vaultT.demoWarning} />
      <StartActions />
      <ExtensionOffer />
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
            <VaultRow key={vault.vaultKey} vault={vault} onDelete={setDeleting} />
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!isNil(deleting)}
        title={vaultT.deviceVaults.deleteTitle(deleting?.name ?? '')}
        description={vaultT.deviceVaults.deleteMessage}
        confirmLabel={vaultT.deviceVaults.deleteConfirm}
        cancelLabel={vaultT.deviceVaults.cancel}
        tone="danger"
        onConfirm={() => {
          if (!isNil(deleting)) {
            void store.forgetVault(deleting.vaultKey);
          }
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
});
