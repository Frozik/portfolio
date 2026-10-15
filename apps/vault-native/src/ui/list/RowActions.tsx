import type { IVaultCard } from '@frozik/vault/model/card';
import {
  archiveCard,
  restoreCard,
  setFavorite,
  trashCard,
  unarchiveCard,
} from '@frozik/vault/model/card-edits';
import { selectionAsync } from 'expo-haptics';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import { changeCard } from '@frozik/vault-app/document/application/card-actions';
import { readCard } from '@frozik/vault-app/document/application/card-reading';

import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import { useVaultTexts } from '../texts';
import { useCopied } from '../vault/copy-feedback';
import { useSession } from '../vault/session-context';

/** A long press on a row: copy a field without opening the card, and the card's own marks. */
export const RowActions = observer(function RowActions({
  card,
  onClose,
}: {
  readonly card: IVaultCard;
  readonly onClose: () => void;
}) {
  const session = useSession();
  const announce = useCopied();
  const t = useVaultTexts();
  const shut = card.protected && !session.protectedGate.isOpen;
  const [firstTab] = readCard(card, shut).tabs;
  const copies = (firstTab?.fields ?? []).flatMap(field =>
    field.kind === 'values' && field.copyable && field.values.length > 0
      ? [{ id: field.id, label: field.label, text: field.values[0]?.copyText ?? '' }]
      : []
  );
  const change = (edit: Parameters<typeof changeCard>[1]): void => {
    session.transact(changeCard(card.id, edit));
    onClose();
  };
  const copy = (label: string, text: string): void => {
    void session.clipboard.copy(text).then(written => {
      if (written) {
        void selectionAsync();
        announce(label);
      }
    });
    onClose();
  };
  return (
    <Dialog
      testID="row-actions"
      open
      title={card.title === '' ? t.list.untitled : card.title}
      onClose={onClose}
    >
      {copies.map(field => (
        <Button
          key={field.id}
          testID="row-copy"
          label={t.menu.copyField(field.label)}
          onPress={() => copy(field.label, field.text)}
        />
      ))}
      {!session.readOnly && (
        <>
          <Button
            testID="row-favorite"
            variant="secondary"
            label={card.favorite ? t.menu.unfavorite : t.menu.favorite}
            onPress={() => change(state => setFavorite(state, !card.favorite))}
          />
          {isNil(card.trashedAt) ? (
            <>
              <Button
                testID="row-archive"
                variant="secondary"
                label={isNil(card.archivedAt) ? t.menu.archive : t.menu.unarchive}
                onPress={() =>
                  change((state, at) =>
                    isNil(card.archivedAt) ? archiveCard(state, at) : unarchiveCard(state)
                  )
                }
              />
              <Button
                testID="row-trash"
                variant="danger"
                label={t.menu.trash}
                onPress={() => change(trashCard)}
              />
            </>
          ) : (
            <Button
              testID="row-restore"
              variant="secondary"
              label={t.menu.restore}
              onPress={() => change(restoreCard)}
            />
          )}
        </>
      )}
      <Button variant="secondary" label={t.menu.cancel} onPress={onClose} />
    </Dialog>
  );
});
