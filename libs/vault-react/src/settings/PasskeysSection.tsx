import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { PasskeysPanel } from './PasskeysPanel';

/** The passkeys panel with its flow, for as long as the settings show it. */
export const PasskeysSection = observer(({ session }: { readonly session: VaultSession }) => {
  const [flow] = useState(() => session.flows.passkeysOf());
  return <PasskeysPanel flow={flow} keys={session.keys} />;
});
