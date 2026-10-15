import type { IKnownVault } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { ChevronRight, Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { cn } from '@frozik/components/components/cn';

import { Alert } from '@frozik/components/ui/Alert';
import { Button } from '@frozik/components/ui/Button';
import { ConfirmDialog } from '@frozik/components/ui/ConfirmDialog';
import { Spinner } from '@frozik/components/ui/Spinner';
import type { VaultRegistryModel } from '@frozik/vault-app/device/application/VaultRegistryModel';
import { storageFailureText } from '@frozik/vault-app/texts/vault/storage-failure-wording';
import { vaultT } from '@frozik/vault-react/texts/vault';
import { paths } from '../paths';

const ICON_SIZE = 18;

const VaultRow = ({
  vault,
  onDelete,
}: {
  readonly vault: IKnownVault;
  readonly onDelete: () => void;
}) => (
  <li className="flex items-center gap-2">
    <Link
      to={paths.vault(vault.vaultKey)}
      data-testid="vault-row"
      className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg border border-line bg-bg-card px-4 py-3 text-fg no-underline"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[16px] font-medium">{vault.name}</span>
        {vault.description.length > 0 && (
          <span className="line-clamp-2 text-[14px] text-fg-dim">{vault.description}</span>
        )}
        {vault.unsyncedChanges && (
          <span className="text-[12px] text-caution">{vaultT.deviceVaults.unsynced}</span>
        )}
      </span>
      <ChevronRight size={ICON_SIZE} aria-hidden className="text-fg-faint" />
    </Link>
    <Button
      type="button"
      variant="ghost"
      size="icon"
      data-testid="vault-delete"
      aria-label={vaultT.deviceVaults.delete(vault.name)}
      title={vaultT.deviceVaults.delete(vault.name)}
      onClick={onDelete}
    >
      <Trash2 size={ICON_SIZE} aria-hidden />
    </Button>
  </li>
);

/** The vaults this device knows, open before any unlock: names and descriptions only. */
export const VaultList = observer(
  ({
    registry,
    className,
    onForget,
  }: {
    readonly registry: VaultRegistryModel;
    readonly className?: string;
    /** Removes the vault from this device, once the user confirmed it. */
    readonly onForget: (vault: IKnownVault) => void;
  }) => {
    const [deleting, setDeleting] = useState<IKnownVault | null>(null);
    const { vaults } = registry;
    if (!isNil(vaults.fail)) {
      return <Alert type="error" message={storageFailureText(vaultT, vaults.fail)} />;
    }
    if (isNil(vaults.value)) {
      return <Spinner />;
    }
    if (vaults.value.length === 0) {
      return (
        <p className="text-[15px] text-fg-dim" data-testid="no-vaults">
          {vaultT.deviceVaults.empty}
        </p>
      );
    }
    return (
      <>
        <ul className={cn('flex flex-col gap-3', className)} data-testid="vault-list">
          {vaults.value.map(vault => (
            <VaultRow key={vault.vaultKey} vault={vault} onDelete={() => setDeleting(vault)} />
          ))}
        </ul>
        <ConfirmDialog
          open={!isNil(deleting)}
          title={vaultT.deviceVaults.deleteTitle(deleting?.name ?? '')}
          description={vaultT.deviceVaults.deleteMessage}
          confirmLabel={vaultT.deviceVaults.deleteConfirm}
          cancelLabel={vaultT.deviceVaults.cancel}
          tone="danger"
          onConfirm={() => {
            if (!isNil(deleting)) {
              onForget(deleting);
            }
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      </>
    );
  }
);
