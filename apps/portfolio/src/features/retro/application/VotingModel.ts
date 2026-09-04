import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import type { CardId, ClientId, GroupId, IRetroSnapshot } from '../domain/types';
import { canPlaceVote, canRetractVote, countVotesUsedByClient } from '../domain/voting';

export interface IVotingModelDeps {
  readonly readSnapshot: () => IRetroSnapshot | undefined;
  readonly readClientId: () => ClientId;
  readonly addVote: (targetId: CardId | GroupId, clientId: ClientId) => void;
  readonly removeVote: (targetId: CardId | GroupId, clientId: ClientId) => void;
}

/** The local participant's votes: the allowance left and the guarded add/remove commands. */
export class VotingModel {
  private readonly deps: IVotingModelDeps;

  constructor(deps: IVotingModelDeps) {
    this.deps = deps;
    // `canAddVoteTo` is called while rendering, so it must stay a tracked
    // derivation rather than an untracked action.
    makeAutoObservable<VotingModel, 'deps'>(
      this,
      { deps: false, canAddVoteTo: false },
      { autoBind: true }
    );
  }

  get myVotesUsed(): number {
    const votes = this.deps.readSnapshot()?.votes;
    return isNil(votes) ? 0 : countVotesUsedByClient(votes, this.deps.readClientId());
  }

  canAddVoteTo(targetId: CardId | GroupId): boolean {
    const snapshot = this.deps.readSnapshot();
    if (isNil(snapshot)) {
      return false;
    }
    return canPlaceVote({
      phase: snapshot.meta.phase,
      votes: snapshot.votes,
      targetId,
      clientId: this.deps.readClientId(),
      votesPerParticipant: snapshot.meta.votesPerParticipant,
    }).allowed;
  }

  add(targetId: CardId | GroupId): void {
    if (this.canAddVoteTo(targetId)) {
      this.deps.addVote(targetId, this.deps.readClientId());
    }
  }

  remove(targetId: CardId | GroupId): void {
    const snapshot = this.deps.readSnapshot();
    if (isNil(snapshot)) {
      return;
    }
    const clientId = this.deps.readClientId();
    if (canRetractVote(snapshot.meta.phase, snapshot.votes, targetId, clientId)) {
      this.deps.removeVote(targetId, clientId);
    }
  }
}
