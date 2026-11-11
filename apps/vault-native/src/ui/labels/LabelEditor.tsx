import type { TGroupId } from '@frozik/vault/model/ids';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import {
  changeGroup,
  newGroup,
  removeGroup,
} from '@frozik/vault-app/document/application/card-actions';

import { useSettingsTexts } from '../texts';
import { useSession } from '../vault/session-context';
import { LabelDialog } from './LabelDialog';

export type TLabelEditing =
  | { readonly kind: 'new' }
  | { readonly kind: 'label'; readonly groupId: TGroupId };

/** The label dialog wired to the vault: a new label is made, an existing one changed or deleted. */
export const LabelEditor = observer(function LabelEditor({
  editing,
  onClose,
}: {
  readonly editing: TLabelEditing;
  readonly onClose: () => void;
}) {
  const session = useSession();
  const t = useSettingsTexts().labels;
  if (editing.kind === 'new') {
    return (
      <LabelDialog
        title={t.add}
        initial={{ name: '', color: null }}
        onSave={({ name, color }) => {
          session.transact(newGroup(name, session.random, color));
          onClose();
        }}
        onClose={onClose}
      />
    );
  }
  const group = session.document.groups.get(editing.groupId);
  if (isNil(group)) {
    return null;
  }
  return (
    <LabelDialog
      title={t.edit(group.name)}
      initial={{ name: group.name, color: group.color }}
      onSave={change => {
        session.transact(changeGroup(group.id, change));
        onClose();
      }}
      onDelete={() => {
        session.transact(removeGroup(group.id));
        onClose();
      }}
      onClose={onClose}
    />
  );
});
