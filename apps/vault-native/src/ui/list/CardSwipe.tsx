import type { IVaultCard } from '@frozik/vault/model/card';
import { archiveCard, restoreCard, trashCard, unarchiveCard } from '@frozik/vault/model/card-edits';
import { isNil } from 'lodash-es';
import { Archive, ArchiveRestore, Trash2, Undo2 } from 'lucide-react-native';
import { observer } from 'mobx-react-lite';
import type { ComponentProps, ReactNode } from 'react';

import { changeCard, purge } from '@frozik/vault-app/document/application/card-actions';

import { SwipeAction } from '../kit/SwipeAction';
import { useVaultTexts } from '../texts';
import { useSession } from '../vault/session-context';

type TSwipeActions = Pick<ComponentProps<typeof SwipeAction>, 'start' | 'end'>;

/**
 * A row swiped right takes its card one step further out (into the trash, or, from the trash,
 * gone for good); swiped left, into the archive, or one step back out of the archive or the trash.
 */
export const CardSwipe = observer(function CardSwipe({
  card,
  still = false,
  children,
}: {
  readonly card: IVaultCard;
  /** Its ⋯ has slid the row aside: no swipe while the quick actions are out. */
  readonly still?: boolean;
  readonly children: ReactNode;
}) {
  const session = useSession();
  const t = useVaultTexts();
  if (session.readOnly) {
    return children;
  }
  const toTrash = {
    icon: Trash2,
    label: t.menu.trash,
    tone: 'danger',
    testID: 'row-swipe-trash',
    onPress: () => session.transact(changeCard(card.id, trashCard)),
  } as const;
  const actions = ((): TSwipeActions => {
    if (!isNil(card.trashedAt)) {
      return {
        start: {
          icon: Trash2,
          label: t.menu.purge,
          tone: 'danger',
          testID: 'row-swipe-purge',
          onPress: () => session.transact(purge(card.id)),
        },
        end: {
          icon: Undo2,
          label: t.menu.restore,
          tone: 'accent',
          testID: 'row-swipe-restore',
          onPress: () => session.transact(changeCard(card.id, restoreCard)),
        },
      };
    }
    if (!isNil(card.archivedAt)) {
      return {
        start: toTrash,
        end: {
          icon: ArchiveRestore,
          label: t.menu.unarchive,
          tone: 'accent',
          testID: 'row-swipe-unarchive',
          onPress: () => session.transact(changeCard(card.id, unarchiveCard)),
        },
      };
    }
    return {
      start: toTrash,
      end: {
        icon: Archive,
        label: t.menu.archive,
        tone: 'caution',
        testID: 'row-swipe-archive',
        onPress: () => session.transact(changeCard(card.id, archiveCard)),
      },
    };
  })();
  return (
    <SwipeAction start={actions.start} end={actions.end} enabled={!still} showing={card.id}>
      {children}
    </SwipeAction>
  );
});
