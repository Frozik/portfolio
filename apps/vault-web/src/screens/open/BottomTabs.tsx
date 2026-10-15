import { cn } from '@frozik/components/components/cn';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import type { LucideIcon } from 'lucide-react';
import { KeyRound, Search, Settings, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { vaultT } from '@frozik/vault-react/texts/vault';
import { paths } from '../paths';
import { SEARCH_STATE } from './CardListScreen';

const ICON_SIZE = 22;

export type TBottomTab = 'vault' | 'search' | 'audit' | 'settings';

const Tab = ({
  to,
  state,
  icon: Icon,
  label,
  current,
  name,
}: {
  readonly to: string;
  readonly state?: object;
  readonly icon: LucideIcon;
  readonly label: string;
  readonly current: boolean;
  readonly name: TBottomTab;
}) => (
  <Link
    to={to}
    state={state}
    data-testid={`tab-${name}`}
    aria-current={current ? 'page' : undefined}
    className={cn(
      'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[12px] no-underline',
      current ? 'text-accent' : 'text-fg-dim'
    )}
  >
    <Icon size={ICON_SIZE} aria-hidden />
    {label}
  </Link>
);

/** The phone's way around an open vault, inside the bottom safe area. */
export function BottomTabs({
  vaultKey,
  current,
}: {
  readonly vaultKey: TVaultKey;
  readonly current: TBottomTab | null;
}) {
  const t = vaultT.phone.tabs;
  return (
    <nav
      aria-label={vaultT.sidebar.label}
      className="sticky bottom-0 z-20 flex border-t border-line bg-bg-elevated pb-[env(safe-area-inset-bottom)]"
    >
      <Tab
        to={paths.section(vaultKey, 'all')}
        icon={KeyRound}
        label={t.vault}
        current={current === 'vault'}
        name="vault"
      />
      <Tab
        to={paths.section(vaultKey, 'all')}
        state={SEARCH_STATE}
        icon={Search}
        label={t.search}
        current={current === 'search'}
        name="search"
      />
      <Tab
        to={paths.audit(vaultKey)}
        icon={ShieldCheck}
        label={t.audit}
        current={current === 'audit'}
        name="audit"
      />
      <Tab
        to={paths.settings(vaultKey)}
        icon={Settings}
        label={t.settings}
        current={current === 'settings'}
        name="settings"
      />
    </nav>
  );
}
