import type { IStorageObjectStat, TStoragePath } from '@frozik/cloud-storage/core/storage-provider';
import { isNil } from 'lodash-es';
import { memo } from 'react';

import { Button } from '../../../../shared/ui/Button';
import { cloudT } from '../translations/cloud';

/** What a cloud panel offers once the folder is reached: keep the open vault there, or open one found there. */
export type TCloudPanelAction =
  | { readonly kind: 'keep'; readonly onKeep: () => void }
  | {
      readonly kind: 'open';
      readonly onOpen: (path: TStoragePath) => void;
      /** An empty folder offers a new vault made right there. */
      readonly onCreate?: () => void;
    };

export const FoundVaults = memo(
  ({
    vaults,
    action,
  }: {
    readonly vaults: readonly IStorageObjectStat[];
    readonly action: TCloudPanelAction;
  }) => {
    const t = cloudT.section;
    if (action.kind === 'keep') {
      return (
        <div className="flex flex-col gap-2">
          {vaults.length > 0 && <p className="text-[13px] text-landing-fg-dim">{t.mergesWith}</p>}
          <Button type="button" className="self-start" onClick={action.onKeep}>
            {t.keepHere}
          </Button>
        </div>
      );
    }
    if (vaults.length === 0) {
      return (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] text-landing-fg-dim">{t.noVaultsToOpen}</p>
          {!isNil(action.onCreate) && (
            <Button type="button" className="self-start" onClick={action.onCreate}>
              {t.createHere}
            </Button>
          )}
        </div>
      );
    }
    return (
      <ul className="flex flex-col gap-2">
        {vaults.map(vault => (
          <li key={vault.path} className="flex items-center gap-3">
            <span className="text-[14px] text-landing-fg">{vault.path}</span>
            <Button type="button" size="sm" onClick={() => action.onOpen(vault.path)}>
              {t.open}
            </Button>
          </li>
        ))}
      </ul>
    );
  }
);
