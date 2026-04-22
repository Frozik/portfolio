import { observer } from 'mobx-react-lite';
import type { RoomStore } from '../../application/RoomStore';
import type { IRetroCard, IRetroGroup } from '../../domain/types';
import { ERetroPhase } from '../../domain/types';
import { countTotalVotesOnTarget } from '../../domain/voting';
import { retroT as t } from '../translations';
import { ActionItemsList } from './ActionItemsList';

interface DiscussPanelProps {
  readonly store: RoomStore;
}

const TOP_CARDS_LIMIT = 5;

type TRankedEntry =
  | {
      readonly kind: 'card';
      readonly id: string;
      readonly card: IRetroCard;
      readonly votes: number;
    }
  | {
      readonly kind: 'group';
      readonly id: string;
      readonly group: IRetroGroup;
      readonly cards: readonly IRetroCard[];
      readonly votes: number;
    };

export const DiscussPanel = observer(({ store }: DiscussPanelProps) => {
  if (store.phase !== ERetroPhase.Discuss) {
    return null;
  }

  const snapshot = store.currentSnapshot;
  if (snapshot === null) {
    return null;
  }

  const cardEntries: TRankedEntry[] = snapshot.cards
    .filter(card => card.groupId === null)
    .map(card => ({
      kind: 'card',
      id: card.id,
      card,
      votes: countTotalVotesOnTarget(snapshot.votes, card.id),
    }));

  const groupEntries: TRankedEntry[] = snapshot.groups.map(group => {
    const cardsInGroup = snapshot.cards.filter(card => card.groupId === group.id);
    return {
      kind: 'group',
      id: group.id,
      group,
      cards: cardsInGroup,
      votes: countTotalVotesOnTarget(snapshot.votes, group.id),
    };
  });

  const ranked = [...cardEntries, ...groupEntries]
    .filter(entry => entry.votes > 0)
    .sort((a, b) => b.votes - a.votes)
    .slice(0, TOP_CARDS_LIMIT);

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-lg border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">
          {t.discuss.topCards}
        </h2>
        {ranked.length === 0 ? (
          <p className="text-sm text-text-muted">—</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {ranked.map((entry, index) => (
              <li
                key={entry.id}
                className="flex items-start gap-3 rounded-md border border-border bg-surface-elevated p-3"
              >
                <span className="text-sm font-semibold text-text-muted">#{index + 1}</span>
                <div className="flex flex-1 flex-col gap-1">
                  {entry.kind === 'card' ? (
                    <span className="whitespace-pre-wrap break-words text-sm">
                      {entry.card.text}
                    </span>
                  ) : (
                    <>
                      <span className="text-xs font-medium text-text-muted">
                        {t.room.groupLabel} · {entry.cards.length}
                      </span>
                      <ul className="flex flex-col gap-0.5">
                        {entry.cards.map(card => (
                          <li
                            key={card.id}
                            className="whitespace-pre-wrap break-words text-sm text-text"
                          >
                            • {card.text}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
                <span className="inline-flex items-center rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-200">
                  {entry.votes}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <ActionItemsList store={store} />
    </section>
  );
});
