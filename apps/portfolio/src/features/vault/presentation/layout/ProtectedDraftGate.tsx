import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import { Alert } from '../../../../shared/ui/Alert';
import { Button } from '../../../../shared/ui/Button';
import type { VaultSession } from '../../application/VaultSession';
import { ProtectedGateDialog } from '../card-view/ProtectedGateDialog';
import { vaultT } from '../translations';

/** A draft of a protected card, continued after unlock, opens only behind the password like the card. */
export const ProtectedDraftGate = observer(({ session }: { readonly session: VaultSession }) => {
  const [opening, setOpening] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Alert type="info" message={vaultT.card.protectedNotice} />
      <Button type="button" size="sm" onClick={() => setOpening(true)}>
        {vaultT.protectedGate.open}
      </Button>
      {opening && <ProtectedGateDialog session={session} onClose={() => setOpening(false)} />}
    </div>
  );
});
