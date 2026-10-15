import { cn } from '@frozik/components/components/cn';
import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';

import type { VaultView } from '@frozik/vault-app/document/application/VaultView';
import { vaultT } from '@frozik/vault-react/texts/vault';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { paths } from '../paths';
import { sectionLabelOf } from './section-label';

/** The sections and groups with their counts, the current one marked. */
export const SectionNav = observer(
  ({
    vaultKey,
    view,
    onPick,
  }: {
    readonly vaultKey: TVaultKey;
    readonly view: VaultView;
    readonly onPick?: () => void;
  }) => (
    <nav aria-label={vaultT.sidebar.label} data-testid="section-nav">
      <ul className="flex flex-col">
        {view.sections.map(entry => (
          <li key={entry.section}>
            <Link
              to={paths.section(vaultKey, entry.section)}
              onClick={onPick}
              data-testid={`section-${entry.section}`}
              aria-current={view.section === entry.section ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center justify-between gap-3 rounded-md px-3 text-[15px] text-fg no-underline hover:bg-bg-elevated',
                view.section === entry.section && 'bg-bg-card'
              )}
            >
              <span className="truncate">{sectionLabelOf(entry)}</span>
              <span className="text-[13px] text-fg-faint">{entry.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
);
