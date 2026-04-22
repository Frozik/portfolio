import { useFunction } from '@frozik/components';
import { ThumbsUp } from 'lucide-react';
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
      <span className="inline-flex items-center gap-1 rounded-full bg-surface-elevated px-2 py-0.5 text-xs font-medium text-text-muted">
        <ThumbsUp size={12} />
        {total}
      </span>
    );
  }

  const canAdd = store.canVoteMore;

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={handleRemove}
        disabled={myVotes === 0}
        className={cn(
          'h-6 w-6 rounded-md border border-border bg-surface text-xs font-semibold',
          'disabled:cursor-not-allowed disabled:opacity-40'
        )}
        aria-label={t.voting.removeVote}
      >
        −
      </button>
      <span className="min-w-4 text-center text-xs font-medium tabular-nums">{myVotes}</span>
      <button
        type="button"
        onClick={handleAdd}
        disabled={!canAdd}
        className={cn(
          'h-6 w-6 rounded-md border border-border bg-surface text-xs font-semibold',
          'disabled:cursor-not-allowed disabled:opacity-40'
        )}
        aria-label={t.voting.addVote}
      >
        +
      </button>
    </div>
  );
});
