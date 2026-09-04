import type { Milliseconds } from '@frozik/utils/date/types';

import { createIdleTimer } from '../domain/timer';
import type { CardId, ClientId, IRetroSnapshot, RetroPhase } from '../domain/types';
import { VotingModel } from './VotingModel';

const ME = 1 as ClientId;
const CARD = 'card-1' as CardId;
const OTHER_CARD = 'card-2' as CardId;

function snapshotIn(phase: RetroPhase, myVotes: ReadonlyMap<CardId, number>): IRetroSnapshot {
  const votes = new Map<CardId, ReadonlyMap<ClientId, number>>();
  myVotes.forEach((count, cardId) => votes.set(cardId, new Map([[ME, count]])));
  return {
    meta: {
      name: 'Sprint',
      createdAt: '2026-09-05T00:00:00Z' as IRetroSnapshot['meta']['createdAt'],
      template: 'scrum-en',
      phase,
      facilitatorClientId: ME,
      facilitatorName: 'Ada',
      votesPerParticipant: 2,
      timer: createIdleTimer(60_000 as Milliseconds),
    },
    columns: [],
    cards: [],
    groups: [],
    actionItems: [],
    votes,
  };
}

function createModel(snapshot: IRetroSnapshot | undefined): {
  readonly model: VotingModel;
  readonly log: string[];
} {
  const log: string[] = [];
  const model = new VotingModel({
    readSnapshot: () => snapshot,
    readClientId: () => ME,
    addVote: targetId => log.push(`add:${targetId}`),
    removeVote: targetId => log.push(`remove:${targetId}`),
  });
  return { model, log };
}

describe('VotingModel', () => {
  it('counts the votes the local participant has spent', () => {
    const { model } = createModel(
      snapshotIn(
        'vote',
        new Map([
          [CARD, 1],
          [OTHER_CARD, 1],
        ])
      )
    );

    expect(model.myVotesUsed).toBe(2);
  });

  it('allows a vote only in the vote phase and while the allowance lasts', () => {
    const inVote = createModel(snapshotIn('vote', new Map([[CARD, 1]])));
    const spent = createModel(
      snapshotIn(
        'vote',
        new Map([
          [CARD, 1],
          [OTHER_CARD, 1],
        ])
      )
    );
    const inDiscuss = createModel(snapshotIn('discuss', new Map()));

    expect(inVote.model.canAddVoteTo(OTHER_CARD)).toBe(true);
    expect(spent.model.canAddVoteTo(OTHER_CARD)).toBe(false);
    expect(inDiscuss.model.canAddVoteTo(CARD)).toBe(false);
    expect(createModel(undefined).model.canAddVoteTo(CARD)).toBe(false);
  });

  it('forwards only permitted add and remove commands to the doc', () => {
    const { model, log } = createModel(snapshotIn('vote', new Map([[CARD, 1]])));

    model.add(OTHER_CARD);
    model.remove(CARD);
    model.remove(OTHER_CARD);

    expect(log).toEqual([`add:${OTHER_CARD}`, `remove:${CARD}`]);
  });
});
