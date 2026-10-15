import { observer } from 'mobx-react-lite';

import { Drawer } from '@frozik/components/ui/Drawer';
import type { VaultView } from '@frozik/vault-app/document/application/VaultView';
import { vaultT } from '@frozik/vault-react/texts/vault';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { SectionNav } from './SectionNav';

/** The sections and groups, in a sheet from the bottom of a phone or the left of a tablet; picking one closes it. */
export const SectionSheet = observer(
  ({
    vaultKey,
    view,
    open,
    onClose,
  }: {
    readonly vaultKey: TVaultKey;
    readonly view: VaultView;
    readonly open: boolean;
    readonly onClose: () => void;
  }) => (
    <Drawer
      title={vaultT.phone.sections}
      open={open}
      onClose={onClose}
      mobile="sheet"
      placement="left"
    >
      <div data-testid="section-sheet">
        <SectionNav vaultKey={vaultKey} view={view} onPick={onClose} />
      </div>
    </Drawer>
  )
);
