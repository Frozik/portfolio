import type { TCardId } from '@frozik/vault/model/ids';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import type { TVaultSection } from '@frozik/vault-app/navigation/vault-pages';

import { EditorScreen } from '../editor/EditorScreen';
import { useSession } from '../vault/session-context';
import { CardScreen } from './CardScreen';

/** A card's page: read, or edited while a draft of it is open. */
export const CardPage = observer(function CardPage({
  section,
  cardId,
}: {
  readonly section: TVaultSection;
  readonly cardId: TCardId;
}) {
  const { draft } = useSession().editing;
  return !isNil(draft) && draft.card.id === cardId ? (
    <EditorScreen draft={draft} />
  ) : (
    <CardScreen section={section} cardId={cardId} />
  );
});
