import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';

import type { UpdateWatch } from '@frozik/vault-app/release/application/UpdateWatch';

import { RequiredUpdateScreen } from './RequiredUpdateScreen';

/** A build below the published security floor shows only why it waits. */
export const UpdateGate = observer(function UpdateGate({
  updates,
  children,
}: {
  readonly updates: UpdateWatch;
  readonly children: ReactNode;
}) {
  return updates.verdict === 'required' ? <RequiredUpdateScreen /> : children;
});
