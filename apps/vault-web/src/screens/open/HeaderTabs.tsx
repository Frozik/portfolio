import { cn } from '@frozik/components/components/cn';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { Link } from 'react-router-dom';

import { vaultT } from '@frozik/vault-react/texts/vault';
import { paths } from '../paths';
import type { TBottomTab } from './BottomTabs';

type THeaderTab = Exclude<TBottomTab, 'search'>;

/** A wide screen's way around an open vault, in the header: the search is always in sight there. */
export function HeaderTabs({
  vaultKey,
  current,
}: {
  readonly vaultKey: TVaultKey;
  readonly current: TBottomTab | null;
}) {
  const t = vaultT.phone.tabs;
  const tabs: readonly { readonly name: THeaderTab; readonly to: string }[] = [
    { name: 'vault', to: paths.section(vaultKey, 'all') },
    { name: 'audit', to: paths.audit(vaultKey) },
    { name: 'settings', to: paths.settings(vaultKey) },
  ];
  return (
    <nav aria-label={vaultT.sidebar.label} className="flex items-center gap-1">
      {tabs.map(({ name, to }) => {
        const chosen = current === name || (name === 'vault' && current === 'search');
        return (
          <Link
            key={name}
            to={to}
            data-testid={`tab-${name}`}
            aria-current={chosen ? 'page' : undefined}
            className={cn(
              'flex min-h-9 items-center rounded-md px-3 text-[14px] no-underline hover:bg-bg-elevated',
              chosen ? 'bg-bg-card text-fg' : 'text-fg-dim'
            )}
          >
            {t[name]}
          </Link>
        );
      })}
    </nav>
  );
}
