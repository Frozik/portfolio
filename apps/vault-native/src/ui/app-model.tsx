import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

import type { TFollowIncomingFiles } from '@frozik/vault-app/cloud/domain/ports/vault-file-picker';
import type { DiagnosticsModel } from '@frozik/vault-app/diagnostics/application/DiagnosticsModel';
import type { PendingImport } from '@frozik/vault-app/interchange/application/PendingImport';
import type { TSaveFile } from '@frozik/vault-app/interchange/domain/ports/file-saver';
import type { UpdateWatch } from '@frozik/vault-app/release/application/UpdateWatch';
import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';

export interface IAppModel {
  readonly app: VaultApp;
  readonly updates: UpdateWatch;
  /** Files other apps hand over, each taken in as a vault file. */
  readonly followIncomingFiles: TFollowIncomingFiles;
  /** A file handed over that waits for a vault to import it into. */
  readonly pendingImport: PendingImport;
  /** Where a card's file goes: a folder the user picks (Downloads), or another app through the share sheet. */
  readonly fileSavers: { readonly saveToFolder: TSaveFile; readonly share: TSaveFile };
  /** This phone's diagnostics log, under Settings. */
  readonly diagnostics: DiagnosticsModel;
  /** This build's release, shown so a user can tell which one runs. */
  readonly version: string;
  /**
   * This runtime's launch, given once: the vault a lock just closed, if any. The start screen then
   * opens the vault the app works on; later visits to it stay on the list.
   */
  readonly takeLaunch: () => { readonly locked: string | null } | null;
}

const AppModelContext = createContext<IAppModel | null>(null);

/** The models the root layout made, for every screen below. */
export function AppModel({
  model,
  children,
}: {
  readonly model: IAppModel;
  readonly children: ReactNode;
}) {
  return <AppModelContext value={model}>{children}</AppModelContext>;
}

export function useAppModel(): IAppModel {
  const model = useContext(AppModelContext);
  assert(!isNil(model), 'useAppModel is used outside AppModel');
  return model;
}
