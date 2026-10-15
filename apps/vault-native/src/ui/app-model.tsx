import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

import type { UpdateWatch } from '@frozik/vault-app/release/application/UpdateWatch';
import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';

export interface IAppModel {
  readonly app: VaultApp;
  readonly updates: UpdateWatch;
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
