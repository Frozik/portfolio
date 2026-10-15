import type { IVaultCard } from '@frozik/vault/model/card';
import {
  addToGroup,
  archiveCard,
  removeFromGroup,
  restoreCard,
  setFavorite,
  trashCard,
  unarchiveCard,
} from '@frozik/vault/model/card-edits';
import type { TCardId } from '@frozik/vault/model/ids';
import { isNil } from 'lodash-es';
import { MoreHorizontal } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import { Button } from '@frozik/components/ui/Button';
import { ConfirmDialog } from '@frozik/components/ui/ConfirmDialog';
import { Dropdown, DropdownItem } from '@frozik/components/ui/Dropdown';
import { changeCard, duplicate, purge } from '@frozik/vault-app/document/application/card-actions';
import { changeProtection } from '@frozik/vault-app/document/application/card-protection';
import { saveCardAsTemplate } from '@frozik/vault-app/document/application/template-actions';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { NameDialog } from '../form/NameDialog';
import { ProtectedGateDialog } from '../protected/ProtectedGateDialog';
import { vaultT } from '../texts/vault';
import { NewGroupDialog } from './NewGroupDialog';

const ICON_SIZE = 16;

/** The card's menu: the small edits that need no editor and go straight into the vault. */
export const CardMenu = observer(
  ({
    card,
    session,
    onDuplicated,
    onPurged,
  }: {
    readonly card: IVaultCard;
    readonly session: VaultSession;
    readonly onDuplicated: (cardId: TCardId) => void;
    readonly onPurged: () => void;
  }) => {
    const t = vaultT.menu;
    const [confirmingPurge, setConfirmingPurge] = useState(false);
    const [namingGroup, setNamingGroup] = useState(false);
    const [namingTemplate, setNamingTemplate] = useState(false);
    const [unprotecting, setUnprotecting] = useState(false);
    const groups = [...session.document.groups.values()];
    const trashed = !isNil(card.trashedAt);
    const change = (edit: Parameters<typeof changeCard>[1]): void => {
      session.transact(changeCard(card.id, edit));
    };

    return (
      <>
        <Dropdown
          trigger={
            <Button type="button" variant="ghost" size="sm" aria-label={t.label}>
              <MoreHorizontal size={ICON_SIZE} />
            </Button>
          }
        >
          {trashed ? (
            <>
              <DropdownItem onSelect={() => change(restoreCard)}>{t.restore}</DropdownItem>
              <DropdownItem onSelect={() => setConfirmingPurge(true)}>{t.purge}</DropdownItem>
            </>
          ) : (
            <>
              <DropdownItem onSelect={() => change(state => setFavorite(state, !card.favorite))}>
                {card.favorite ? t.unfavorite : t.favorite}
              </DropdownItem>
              <DropdownItem
                onSelect={() => {
                  const copy = session.transact(
                    duplicate(card.id, t.copyTitle(card.title), session.random)
                  );
                  if (!isNil(copy)) {
                    onDuplicated(copy);
                  }
                }}
              >
                {t.duplicate}
              </DropdownItem>
              {groups.map(group =>
                card.groupIds.includes(group.id) ? (
                  <DropdownItem
                    key={group.id}
                    onSelect={() => change(state => removeFromGroup(state, group.id))}
                  >
                    {t.removeFrom(group.name)}
                  </DropdownItem>
                ) : (
                  <DropdownItem
                    key={group.id}
                    onSelect={() => change(state => addToGroup(state, group.id))}
                  >
                    {t.addTo(group.name)}
                  </DropdownItem>
                )
              )}
              <DropdownItem onSelect={() => setNamingGroup(true)}>{t.newGroup}</DropdownItem>
              <DropdownItem onSelect={() => setNamingTemplate(true)}>
                {t.saveAsTemplate}
              </DropdownItem>
              <DropdownItem
                onSelect={() => {
                  if (changeProtection(session, card.id, !card.protected) === 'password-needed') {
                    setUnprotecting(true);
                  }
                }}
              >
                {card.protected ? t.unprotect : t.protect}
              </DropdownItem>
              <DropdownItem
                onSelect={() =>
                  change((state, at) =>
                    isNil(card.archivedAt) ? archiveCard(state, at) : unarchiveCard(state)
                  )
                }
              >
                {isNil(card.archivedAt) ? t.archive : t.unarchive}
              </DropdownItem>
              <DropdownItem onSelect={() => change(trashCard)}>{t.trash}</DropdownItem>
            </>
          )}
        </Dropdown>
        {unprotecting && (
          <ProtectedGateDialog
            session={session}
            onClose={() => {
              setUnprotecting(false);
              changeProtection(session, card.id, false);
            }}
          />
        )}
        <ConfirmDialog
          open={confirmingPurge}
          title={t.purgeTitle}
          description={t.purgeMessage}
          confirmLabel={t.purge}
          cancelLabel={t.cancel}
          tone="danger"
          onConfirm={() => {
            setConfirmingPurge(false);
            session.transact(purge(card.id));
            onPurged();
          }}
          onCancel={() => setConfirmingPurge(false)}
        />
        {namingTemplate && (
          <NameDialog
            title={t.saveAsTemplate}
            label={t.templateName}
            confirmLabel={t.saveTemplate}
            initial={card.title}
            onSubmit={name => session.transact(saveCardAsTemplate(card.id, name, session.random))}
            onClose={() => setNamingTemplate(false)}
          />
        )}
        {namingGroup && (
          <NewGroupDialog
            session={session}
            onCreated={groupId => change(state => addToGroup(state, groupId))}
            onClose={() => setNamingGroup(false)}
          />
        )}
      </>
    );
  }
);
