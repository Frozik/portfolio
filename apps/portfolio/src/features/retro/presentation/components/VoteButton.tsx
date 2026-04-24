import { useFunction } from '@frozik/components/hooks/useFunction';
import { Minus, Plus, Star } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { cn } from '../../../../shared/lib/cn';
import type { RoomStore } from '../../application/RoomStore';
import type { CardId, ClientId, GroupId } from '../../domain/types';
import { ERetroPhase } from '../../domain/types';
import { retroT as t } from '../translations';

interface VoteButtonProps {
  readonly store: RoomStore;
  readonly targetId: CardId | GroupId;
}

export const VoteButton = observer(({ store, targetId }: VoteButtonProps) => {
  const handleAdd = useFunction(() => store.addVote(targetId));
  const handleRemove = useFunction(() => store.removeVote(targetId));

  const phase = store.phase;
  if (phase !== ERetroPhase.Vote && phase !== ERetroPhase.Discuss) {
    return null;
  }

  const myClientId = store.identity.clientId as ClientId;
  const perClient = store.currentSnapshot?.votes.get(targetId);
  const myVotes = perClient?.get(myClientId) ?? 0;

  if (phase === ERetroPhase.Discuss) {
    let total = 0;
    perClient?.forEach(count => {
      total += count;
    });
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 border px-2 py-[3px] font-mono text-[10px]',
          total > 0
            ? 'border-landing-accent/40 bg-landing-accent/10 text-landing-accent'
            : 'border-landing-border-soft text-landing-fg-faint'
        )}
      >
        <Star size={9} strokeWidth={1.6} fill={total > 0 ? 'currentColor' : 'none'} />
        <span className="tabular-nums">{total}</span>
      </span>
    );
  }

  const canAdd = store.canVoteMore;
  const isVoted = myVotes > 0;

  return (
    <span
      className={cn(
        'inline-flex items-center border font-mono text-[10px] transition-colors',
        isVoted
          ? 'border-landing-accent/40 bg-landing-accent/10 text-landing-accent hover:border-landing-accent hover:bg-landing-accent/15'
          : 'border-landing-border-soft text-landing-fg-dim hover:border-landing-accent/40 hover:bg-landing-accent/10'
      )}
    >
      <button
        type="button"
        onClick={handleRemove}
        disabled={myVotes === 0}
        aria-label={t.voting.removeVote}
        className="inline-flex h-5 w-5 items-center justify-center transition-colors hover:text-landing-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-current"
      >
        <Minus size={9} strokeWidth={2} />
      </button>
      <span className="inline-flex min-w-4 items-center justify-center gap-1 px-1.5 tabular-nums">
        {isVoted ? (
          <Star size={9} strokeWidth={1.6} fill="currentColor" />
        ) : (
          <Plus size={9} strokeWidth={2} />
        )}
        {myVotes}
      </span>
      <button
        type="button"
        onClick={handleAdd}
        disabled={!canAdd}
        aria-label={t.voting.addVote}
        className="inline-flex h-5 w-5 items-center justify-center transition-colors hover:text-landing-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-current"
      >
        <Plus size={9} strokeWidth={2} />
      </button>
    </span>
  );
});
