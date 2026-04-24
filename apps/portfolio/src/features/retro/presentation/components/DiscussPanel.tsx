import { observer } from 'mobx-react-lite';
import { useMemo } from 'react';

import { CardFrame, MonoKicker } from '../../../../shared/ui';
import type { RoomStore } from '../../application/RoomStore';
import { useUserDirectoryStore } from '../../application/useUserDirectoryStore';
import type {
  ClientId,
  ColumnId,
  IColumnConfig,
  IRetroCard,
  IRetroGroup,
} from '../../domain/types';
import { ERetroPhase } from '../../domain/types';
import { countTotalVotesOnTarget } from '../../domain/voting';
import { retroT as t } from '../translations';
import { ActionItemsList } from './ActionItemsList';

interface DiscussPanelProps {
  readonly store: RoomStore;
}

const TOP_CARDS_LIMIT = 5;
const RANK_PAD_LENGTH = 2;
const RANK_PAD_CHAR = '0';

type TRankedEntry =
  | {
      readonly kind: 'card';
      readonly id: string;
      readonly card: IRetroCard;
      readonly column: IColumnConfig | null;
      readonly votes: number;
    }
  | {
      readonly kind: 'group';
      readonly id: string;
      readonly group: IRetroGroup;
      readonly column: IColumnConfig | null;
      readonly cards: readonly IRetroCard[];
      readonly votes: number;
    };

function formatRank(rank: number): string {
  return String(rank).padStart(RANK_PAD_LENGTH, RANK_PAD_CHAR);
}

export const DiscussPanel = observer(({ store }: DiscussPanelProps) => {
  const directory = useUserDirectoryStore();
  const snapshot = store.currentSnapshot;

  const ranked = useMemo<readonly TRankedEntry[]>(() => {
    if (snapshot === null) {
      return [];
    }

    const columnById = new Map<ColumnId, IColumnConfig>();
    snapshot.columns.forEach(column => {
      columnById.set(column.id, column);
    });

    const cardEntries: TRankedEntry[] = snapshot.cards
      .filter(card => card.groupId === null)
      .map(card => ({
        kind: 'card' as const,
        id: card.id,
        card,
        column: columnById.get(card.columnId) ?? null,
        votes: countTotalVotesOnTarget(snapshot.votes, card.id),
      }));

    const groupEntries: TRankedEntry[] = snapshot.groups.map(group => {
      const cardsInGroup = snapshot.cards.filter(card => card.groupId === group.id);
      return {
        kind: 'group' as const,
        id: group.id,
        group,
        column: columnById.get(group.columnId) ?? null,
        cards: cardsInGroup,
        votes: countTotalVotesOnTarget(snapshot.votes, group.id),
      };
    });

    return [...cardEntries, ...groupEntries]
      .filter(entry => entry.votes > 0)
      .sort((left, right) => right.votes - left.votes)
      .slice(0, TOP_CARDS_LIMIT);
  }, [snapshot]);

  if (store.phase !== ERetroPhase.Discuss) {
    return null;
  }

  if (snapshot === null) {
    return null;
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3.5">
          <MonoKicker tone="accent">{t.discuss.phaseKicker}</MonoKicker>
          <span className="section-rule" />
        </div>
        <h2 className="m-0 text-[15px] font-medium text-landing-fg">{t.discuss.topCardsHeading}</h2>
      </div>

      {ranked.length === 0 ? (
        <CardFrame className="px-4 py-6">
          <MonoKicker tone="faint">{t.discuss.topCardsEmpty}</MonoKicker>
        </CardFrame>
      ) : (
        <ol className="flex flex-col gap-2.5">
          {ranked.map((entry, index) => (
            <li key={entry.id}>
              <RankedEntryRow entry={entry} rank={index + 1} directory={directory} />
            </li>
          ))}
        </ol>
      )}

      <ActionItemsList store={store} />
    </section>
  );
});

interface RankedEntryRowProps {
  readonly entry: TRankedEntry;
  readonly rank: number;
  readonly directory: ReturnType<typeof useUserDirectoryStore>;
}

const RankedEntryRow = observer(({ entry, rank, directory }: RankedEntryRowProps) => {
  const columnTitle = entry.column?.title ?? '';
  const columnColor = entry.column?.color ?? null;
  const rankLabel = formatRank(rank);

  const authorName =
    entry.kind === 'card'
      ? (directory.get(entry.card.authorClientId as ClientId)?.name ?? '').trim()
      : '';
  const authorColor =
    entry.kind === 'card'
      ? (directory.get(entry.card.authorClientId as ClientId)?.color ?? null)
      : null;

  return (
    <CardFrame
      hoverable
      accentColor={columnColor ?? undefined}
      className="flex items-start gap-4 px-4 py-3"
    >
      <MonoKicker tone="accent" className="shrink-0 pt-0.5 text-[11px]">
        #{rankLabel}
      </MonoKicker>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {entry.kind === 'card' ? (
          <p className="m-0 text-[13px] leading-[1.5] whitespace-pre-wrap break-words text-landing-fg">
            {entry.card.text}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <MonoKicker tone="dim">
              {t.discuss.groupedCardsKicker} · {entry.cards.length} {t.room.cardsLabel}
            </MonoKicker>
            <ul className="flex flex-col gap-1">
              {entry.cards.map(card => (
                <li
                  key={card.id}
                  className="text-[13px] leading-[1.5] whitespace-pre-wrap break-words text-landing-fg"
                >
                  <span className="text-landing-fg-faint">·&nbsp;</span>
                  {card.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {columnTitle.length > 0 && (
            <span className="flex items-center gap-1.5">
              {columnColor !== null && (
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  // Column accent is runtime-dynamic per template.
                  style={{ backgroundColor: columnColor }}
                />
              )}
              <MonoKicker tone="dim">{columnTitle}</MonoKicker>
            </span>
          )}
          {authorName.length > 0 && (
            <span className="flex items-center gap-1.5">
              {authorColor !== null && (
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  // Author color is the participant's self-picked palette entry.
                  style={{ backgroundColor: authorColor }}
                />
              )}
              <MonoKicker tone="dim">
                {t.discuss.authorKicker} {authorName}
              </MonoKicker>
            </span>
          )}
        </div>
      </div>

      <span className="inline-flex shrink-0 items-center gap-1 border border-landing-accent/40 bg-landing-accent/10 px-2 py-[3px] font-mono text-[11px] tracking-[0.08em] text-landing-accent">
        {entry.votes}
        <span className="text-landing-accent/70">{t.discuss.votesTag(entry.votes)}</span>
      </span>
    </CardFrame>
  );
});
