import { observer } from 'mobx-react-lite';

import { Alert } from '@frozik/components/ui/Alert';
import type { UpdateWatch } from '@frozik/vault-app/release/application/UpdateWatch';
import { vaultT } from '@frozik/vault-react/texts/vault';

/** A newer build that starts at the next full lock: a chip, never a block. */
export const UpdateNotice = observer(({ watch }: { readonly watch: UpdateWatch }) =>
  watch.verdict === 'available' ? (
    <div data-testid="update-notice" data-state="available">
      <Alert type="info" message={vaultT.update.available} />
    </div>
  ) : null
);
