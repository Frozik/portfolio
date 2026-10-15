import type { TGroupId } from '@frozik/vault/model/ids';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEventCallback } from 'usehooks-ts';

import { newGroup } from '@frozik/vault-app/document/application/card-actions';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { NameDialog } from '../form/NameDialog';
import { vaultT } from '../texts/vault';

/** Names a new group; the card that asked for it joins it at once. */
export const NewGroupDialog = observer(
  ({
    session,
    onCreated,
    onClose,
  }: {
    readonly session: VaultSession;
    readonly onCreated: (groupId: TGroupId) => void;
    readonly onClose: () => void;
  }) => {
    const t = vaultT.menu;
    const create = useEventCallback((name: string) => {
      const groupId = session.transact(newGroup(name, session.random));
      if (!isNil(groupId)) {
        onCreated(groupId);
      }
    });
    return (
      <NameDialog
        title={t.newGroup}
        label={t.groupName}
        confirmLabel={t.createGroup}
        onSubmit={create}
        onClose={onClose}
      />
    );
  }
);
