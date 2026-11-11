import type { TCardId } from '@frozik/vault/model/ids';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';

import type { TVaultSection } from '@frozik/vault-app/navigation/vault-pages';

import { EditorScreen } from '../editor/EditorScreen';
import { useSession } from '../vault/session-context';
import { CardScreen } from './CardScreen';

/** A card's page: read, or edited while a draft of it is open; an unsaved edit of it waiting from before a lock opens straight in the editor. */
export const CardPage = observer(function CardPage({
  section,
  cardId,
}: {
  readonly section: TVaultSection;
  readonly cardId: TCardId;
}) {
  const { editing } = useSession();
  const { draft, offeredDraft } = editing;
  const offeredHere = offeredDraft?.card.id === cardId;
  useEffect(() => {
    if (offeredHere) {
      editing.continueOffered();
    }
  }, [editing, offeredHere]);
  return !isNil(draft) && draft.card.id === cardId ? (
    <EditorScreen draft={draft} />
  ) : (
    <CardScreen section={section} cardId={cardId} />
  );
});
