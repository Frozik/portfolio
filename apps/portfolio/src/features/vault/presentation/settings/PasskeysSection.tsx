import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import type { VaultFeatureStore } from '../../application/VaultFeatureStore';
import type { VaultSession } from '../../application/VaultSession';
import { PasskeysPanel } from './PasskeysPanel';

/** The passkeys panel with its flow, for as long as the settings show it. */
export const PasskeysSection = observer(
  ({ store, session }: { readonly store: VaultFeatureStore; readonly session: VaultSession }) => {
    const [flow] = useState(() => store.passkeysOf(session));
    return <PasskeysPanel flow={flow} keys={session.keys} />;
  }
);
