import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';

import type { VaultView } from '@frozik/vault-app/document/application/VaultView';
import { vaultT } from '@frozik/vault-react/texts/vault';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { SectionNav } from './SectionNav';

/** A wide screen's vault: the sections, the list and the open card side by side. */
export const BrowsePanes = observer(
  ({
    vaultKey,
    view,
    list,
    card,
  }: {
    readonly vaultKey: TVaultKey;
    readonly view: VaultView;
    readonly list: ReactNode;
    /** The card, its editor or its history; `null` until one is chosen. */
    readonly card: ReactNode;
  }) => (
    <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(300px,1fr)_minmax(380px,1.4fr)]">
      <div className="min-h-0 overflow-y-auto border-r border-line px-2 py-3">
        <SectionNav vaultKey={vaultKey} view={view} />
      </div>
      <div className="flex min-h-0 flex-col border-r border-line">{list}</div>
      <div className="flex min-h-0 flex-col" data-testid="card-pane">
        {card ?? <p className="px-4 pt-6 text-[14px] text-fg-faint">{vaultT.card.choose}</p>}
      </div>
    </div>
  )
);
