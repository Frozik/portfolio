import { observer } from 'mobx-react-lite';
import type { RoomStore } from '../../application/RoomStore';
import { ERetroPhase } from '../../domain/types';
import { countTotalVotesOnTarget } from '../../domain/voting';
import { retroEnTranslations as t } from '../translations/en';
import { ActionItemsList } from './ActionItemsList';

interface DiscussPanelProps {
  readonly store: RoomStore;
}

const TOP_CARDS_LIMIT = 5;

export const DiscussPanel = observer(({ store }: DiscussPanelProps) => {
  if (store.phase !== ERetroPhase.Discuss) {
    return null;
  }

  const snapshot = store.currentSnapshot;
  if (snapshot === null) {
    return null;
  }

  const ranked = snapshot.cards
    .map(card => ({ card, votes: countTotalVotesOnTarget(snapshot.votes, card.id) }))
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
            {ranked.map(({ card, votes }, index) => (
              <li
                key={card.id}
                className="flex items-start gap-3 rounded-md border border-border bg-surface-elevated p-3"
              >
                <span className="text-sm font-semibold text-text-muted">#{index + 1}</span>
                <span className="flex-1 whitespace-pre-wrap break-words text-sm">{card.text}</span>
                <span className="inline-flex items-center rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-200">
                  {votes}
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
