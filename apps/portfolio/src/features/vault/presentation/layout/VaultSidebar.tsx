import { cn } from '@frozik/components/components/cn';
import { compareStrings } from '@frozik/vault/model/compare-strings';
import type { TBuiltinGroupId } from '@frozik/vault/model/smart-groups';
import { BUILTIN_GROUP_IDS } from '@frozik/vault/model/smart-groups';
import type { IUserSmartGroup } from '@frozik/vault/model/vault-document';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { isNil, noop } from 'lodash-es';
import { Pencil } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { Button } from '../../../../shared/ui/Button';
import { SmartGroupBuilder } from '../../application/SmartGroupBuilder';
import type { VaultSession } from '../../application/VaultSession';
import type { TVaultSection } from '../../domain/vault-paths';
import { vaultPaths } from '../../domain/vault-paths';
import { NewGroupDialog } from '../card-view/NewGroupDialog';
import { vaultT } from '../translations';
import { SmartGroupDialog } from './SmartGroupDialog';

const ICON_SIZE = 14;

/** Sections shown even when empty: the ones a user looks for by name. */
const ALWAYS_SHOWN: ReadonlySet<TBuiltinGroupId> = new Set([
  'all',
  'favorites',
  'archive',
  'trash',
]);

const SectionLink = observer(
  ({
    vaultKey,
    section,
    label,
    count,
    current,
    onNavigate,
  }: {
    readonly vaultKey: TVaultKey;
    readonly section: TVaultSection;
    readonly label: string;
    readonly count: number;
    readonly current: boolean;
    readonly onNavigate?: () => void;
  }) => (
    <NavLink
      to={vaultPaths.section(vaultKey, section)}
      onClick={onNavigate}
      aria-current={current ? 'page' : undefined}
      className={cn(
        'flex items-center justify-between gap-3 rounded-md px-3 py-1.5 text-[13px] text-landing-fg-dim no-underline',
        current ? 'bg-landing-bg-card text-landing-fg' : 'hover:text-landing-fg'
      )}
    >
      <span className="truncate">{label}</span>
      <span className="text-[12px] text-landing-fg-faint">{count}</span>
    </NavLink>
  )
);

/** All cards, the smart groups with their counts (empty ones hide), then the user's groups. */
export const VaultSidebar = observer(
  ({
    session,
    locked,
    onNavigate,
  }: {
    readonly session: VaultSession;
    /** A card is being edited: groups wait until it is saved or cancelled. */
    readonly locked: boolean;
    /** A section was picked: the sliding menu on a phone closes. */
    readonly onNavigate?: () => void;
  }) => {
    const { view, vaultKey } = session;
    const [naming, setNaming] = useState(false);
    const [building, setBuilding] = useState<SmartGroupBuilder | null>(null);
    const navigate = useNavigate();
    const build = (editing: IUserSmartGroup | null): void =>
      setBuilding(
        new SmartGroupBuilder(
          { document: () => session.document, transact: session.transact, random: session.random },
          editing
        )
      );
    const smartGroups = view.userSmartGroups;
    const groups = [...session.document.groups.values()].sort(
      (first, second) => first.order - second.order || compareStrings(first.name, second.name)
    );
    return (
      <nav aria-label={vaultT.sidebar.label} className="flex flex-col gap-1">
        {BUILTIN_GROUP_IDS.filter(
          section => ALWAYS_SHOWN.has(section) || view.countOf(section) > 0
        ).map(section => (
          <SectionLink
            key={section}
            vaultKey={vaultKey}
            section={section}
            label={vaultT.sections[section]}
            count={view.countOf(section)}
            current={view.section === section}
            onNavigate={onNavigate}
          />
        ))}
        {smartGroups.length > 0 && (
          <span className="mt-3 px-3 text-[11px] tracking-wide text-landing-fg-faint uppercase">
            {vaultT.smartGroups.heading}
          </span>
        )}
        {smartGroups.map(group => (
          <div key={group.id} className="flex items-center">
            <div className="min-w-0 flex-1">
              <SectionLink
                vaultKey={vaultKey}
                section={group.id}
                label={group.name}
                count={view.countOf(group.id)}
                current={view.section === group.id}
                onNavigate={onNavigate}
              />
            </div>
            {!session.readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={vaultT.smartGroups.editNamed(group.name)}
                disabled={locked}
                onClick={() => build(group)}
              >
                <Pencil size={ICON_SIZE} />
              </Button>
            )}
          </div>
        ))}
        {groups.length > 0 && (
          <span className="mt-3 px-3 text-[11px] tracking-wide text-landing-fg-faint uppercase">
            {vaultT.sidebar.groups}
          </span>
        )}
        {groups.map(group => (
          <SectionLink
            key={group.id}
            vaultKey={vaultKey}
            section={group.id}
            label={group.name}
            count={view.countOf(group.id)}
            current={view.section === group.id}
            onNavigate={onNavigate}
          />
        ))}
        {!session.readOnly && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-start"
            disabled={locked}
            onClick={() => setNaming(true)}
          >
            {vaultT.shortcuts.newGroup}
          </Button>
        )}
        {!session.readOnly && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="justify-start"
            disabled={locked}
            onClick={() => build(null)}
          >
            {vaultT.smartGroups.add}
          </Button>
        )}
        {!isNil(building) && (
          <SmartGroupDialog
            builder={building}
            session={session}
            onSaved={groupId => void navigate(vaultPaths.section(vaultKey, groupId))}
            onDeleted={groupId => {
              if (view.section === groupId) {
                void navigate(vaultPaths.section(vaultKey, 'all'));
              }
            }}
            onClose={() => setBuilding(null)}
          />
        )}
        {naming && (
          <NewGroupDialog session={session} onCreated={noop} onClose={() => setNaming(false)} />
        )}
      </nav>
    );
  }
);
