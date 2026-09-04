import { assert } from '@frozik/utils/assert/assert';
import type { Milliseconds } from '@frozik/utils/date/types';
import { isNil } from 'lodash-es';
import * as Y from 'yjs';

import { getTemplateById } from '../domain/templates';
import type { CardId, ClientId, ColumnId, GroupId, IRetroSnapshot } from '../domain/types';
import { RetroDocGateway } from './RetroDocGateway';

const FACILITATOR = 1 as ClientId;
const MEMBER = 2 as ClientId;

const WENT_WELL = 'scrum-went-well' as ColumnId;
const TO_IMPROVE = 'scrum-to-improve' as ColumnId;
const UNKNOWN_COLUMN = 'no-such-column' as ColumnId;

const VOTES_PER_PARTICIPANT = 3;

function createGateway(): RetroDocGateway {
  const gateway = new RetroDocGateway(new Y.Doc());
  gateway.initializeIfMissing({
    name: 'Sprint 42',
    template: getTemplateById('scrum-en'),
    facilitatorClientId: FACILITATOR,
    facilitatorName: 'Ada',
    votesPerParticipant: VOTES_PER_PARTICIPANT,
  });
  return gateway;
}

function readSnapshot(gateway: RetroDocGateway): IRetroSnapshot {
  const snapshot = gateway.buildSnapshot();
  assert(!isNil(snapshot), 'expected an initialized retro doc');
  return snapshot;
}

function addCardAndGetId(gateway: RetroDocGateway, columnId: ColumnId, text: string): CardId {
  gateway.addCard({ columnId, authorClientId: MEMBER, text });
  const card = readSnapshot(gateway).cards.find(candidate => candidate.text === text);
  assert(!isNil(card), `card "${text}" was not written`);
  return card.id;
}

describe('RetroDocGateway.buildSnapshot', () => {
  it('returns undefined for a doc that was never initialized', () => {
    const gateway = new RetroDocGateway(new Y.Doc());

    expect(gateway.buildSnapshot()).toBeUndefined();
  });

  it('projects meta and columns after initialization', () => {
    const snapshot = readSnapshot(createGateway());

    expect(snapshot.meta.name).toBe('Sprint 42');
    expect(snapshot.meta.template).toBe('scrum-en');
    expect(snapshot.meta.phase).toBe('brainstorm');
    expect(snapshot.meta.facilitatorClientId).toBe(FACILITATOR);
    expect(snapshot.meta.facilitatorName).toBe('Ada');
    expect(snapshot.meta.votesPerParticipant).toBe(VOTES_PER_PARTICIPANT);
    expect(snapshot.columns.map(column => column.id)).toEqual([
      WENT_WELL,
      TO_IMPROVE,
      'scrum-action-items',
    ]);
    expect(snapshot.cards).toEqual([]);
    expect(snapshot.groups).toEqual([]);
    expect(snapshot.actionItems).toEqual([]);
    expect(snapshot.votes.size).toBe(0);
  });

  it('keeps the original meta when initialization runs twice', () => {
    const gateway = createGateway();

    gateway.initializeIfMissing({
      name: 'Sprint 43',
      template: getTemplateById('scrum-ru'),
      facilitatorClientId: MEMBER,
      facilitatorName: 'Grace',
      votesPerParticipant: 9,
    });

    expect(readSnapshot(gateway).meta.name).toBe('Sprint 42');
  });

  it('falls back to the first template for an unknown template id', () => {
    const gateway = new RetroDocGateway(new Y.Doc());
    gateway.initializeIfMissing({
      name: 'Legacy',
      template: { ...getTemplateById('scrum-en'), id: 'removed-template' },
      facilitatorClientId: FACILITATOR,
      facilitatorName: 'Ada',
      votesPerParticipant: VOTES_PER_PARTICIPANT,
    });

    expect(readSnapshot(gateway).meta.template).toBe('scrum-en');
  });
});

describe('RetroDocGateway cards', () => {
  it('trims card text and records the author', () => {
    const gateway = createGateway();

    gateway.addCard({ columnId: WENT_WELL, authorClientId: MEMBER, text: '  pairing  ' });

    const [card] = readSnapshot(gateway).cards;
    assert(!isNil(card), 'expected the card to be stored');
    expect(card.text).toBe('pairing');
    expect(card.authorClientId).toBe(MEMBER);
    expect(card.columnId).toBe(WENT_WELL);
    expect(card.groupId).toBeUndefined();
  });

  it('ignores blank text and unknown columns', () => {
    const gateway = createGateway();

    gateway.addCard({ columnId: WENT_WELL, authorClientId: MEMBER, text: '   ' });
    gateway.addCard({ columnId: UNKNOWN_COLUMN, authorClientId: MEMBER, text: 'lost' });

    expect(readSnapshot(gateway).cards).toEqual([]);
  });

  it('edits a card only when the editor is its author', () => {
    const gateway = createGateway();
    const cardId = addCardAndGetId(gateway, WENT_WELL, 'original');

    gateway.editCard({ cardId, authorClientId: FACILITATOR, text: 'hijacked' });
    expect(readSnapshot(gateway).cards[0]?.text).toBe('original');

    gateway.editCard({ cardId, authorClientId: MEMBER, text: '  updated  ' });
    expect(readSnapshot(gateway).cards[0]?.text).toBe('updated');
  });

  it('deletes a card', () => {
    const gateway = createGateway();
    const cardId = addCardAndGetId(gateway, WENT_WELL, 'temporary');

    gateway.deleteCard(cardId);

    expect(readSnapshot(gateway).cards).toEqual([]);
  });

  it('moves a card to another column', () => {
    const gateway = createGateway();
    const cardId = addCardAndGetId(gateway, WENT_WELL, 'travels');

    gateway.moveCardToColumn({ cardId, targetColumnId: TO_IMPROVE, targetIndex: 0 });

    expect(readSnapshot(gateway).cards[0]?.columnId).toBe(TO_IMPROVE);
  });

  it('reorders a card inside its column', () => {
    const gateway = createGateway();
    const first = addCardAndGetId(gateway, WENT_WELL, 'first');
    addCardAndGetId(gateway, WENT_WELL, 'second');
    addCardAndGetId(gateway, WENT_WELL, 'third');

    gateway.moveCardToPosition({
      cardId: first,
      targetColumnId: WENT_WELL,
      targetIndex: 3,
      targetGroupId: undefined,
    });

    expect(readSnapshot(gateway).cards.map(card => card.text)).toEqual([
      'second',
      'third',
      'first',
    ]);
  });
});

describe('RetroDocGateway groups', () => {
  it('creates a group holding both cards and drops their per-card votes', () => {
    const gateway = createGateway();
    const dragged = addCardAndGetId(gateway, WENT_WELL, 'dragged');
    const target = addCardAndGetId(gateway, WENT_WELL, 'target');
    gateway.addVote(dragged, MEMBER);
    gateway.addVote(target, FACILITATOR);

    gateway.groupCards(dragged, target);

    const snapshot = readSnapshot(gateway);
    const [group] = snapshot.groups;
    assert(!isNil(group), 'expected a group to be created');
    expect(group.cardIds).toEqual([target, dragged]);
    expect(snapshot.cards.every(card => card.groupId === group.id)).toBe(true);
    expect(snapshot.votes.size).toBe(0);
  });

  it('dissolves a group when a card leaves and only one member remains', () => {
    const gateway = createGateway();
    const dragged = addCardAndGetId(gateway, WENT_WELL, 'dragged');
    const target = addCardAndGetId(gateway, WENT_WELL, 'target');
    gateway.groupCards(dragged, target);

    gateway.moveCardToPosition({
      cardId: dragged,
      targetColumnId: TO_IMPROVE,
      targetIndex: 0,
      targetGroupId: undefined,
    });

    const snapshot = readSnapshot(gateway);
    expect(snapshot.groups).toEqual([]);
    expect(snapshot.cards.every(card => card.groupId === undefined)).toBe(true);
  });

  it('ignores grouping a card with itself', () => {
    const gateway = createGateway();
    const cardId = addCardAndGetId(gateway, WENT_WELL, 'lonely');

    gateway.groupCards(cardId, cardId);

    expect(readSnapshot(gateway).groups).toEqual([]);
  });
});

describe('RetroDocGateway votes', () => {
  it('accumulates and retracts per-client votes', () => {
    const gateway = createGateway();
    const cardId = addCardAndGetId(gateway, WENT_WELL, 'votable');

    gateway.addVote(cardId, MEMBER);
    gateway.addVote(cardId, MEMBER);
    gateway.addVote(cardId, FACILITATOR);
    expect(readSnapshot(gateway).votes.get(cardId)?.get(MEMBER)).toBe(2);

    gateway.removeVote(cardId, MEMBER);
    expect(readSnapshot(gateway).votes.get(cardId)?.get(MEMBER)).toBe(1);

    gateway.removeVote(cardId, MEMBER);
    expect(readSnapshot(gateway).votes.get(cardId)?.has(MEMBER)).toBe(false);
    expect(readSnapshot(gateway).votes.get(cardId)?.get(FACILITATOR)).toBe(1);
  });

  it('ignores retracting a vote that was never placed', () => {
    const gateway = createGateway();
    const cardId = addCardAndGetId(gateway, WENT_WELL, 'untouched');

    gateway.removeVote(cardId, MEMBER);

    expect(readSnapshot(gateway).votes.size).toBe(0);
  });
});

describe('RetroDocGateway action items', () => {
  it('appends trimmed action items and deletes them by id', () => {
    const gateway = createGateway();
    const sourceGroupId = 'group-1' as GroupId;

    gateway.addActionItem('   ', undefined);
    gateway.addActionItem('  write the ADR  ', sourceGroupId);

    const [item] = readSnapshot(gateway).actionItems;
    assert(!isNil(item), 'expected the action item to be stored');
    expect(item.text).toBe('write the ADR');
    expect(item.sourceGroupId).toBe(sourceGroupId);
    expect(item.ownerClientId).toBeUndefined();

    gateway.deleteActionItem(item.id);
    expect(readSnapshot(gateway).actionItems).toEqual([]);
  });
});

describe('RetroDocGateway meta writes', () => {
  it('round-trips phase, timer and facilitator through the snapshot', () => {
    const gateway = createGateway();

    gateway.setPhase('vote');
    gateway.setTimer({
      durationMs: 60_000 as Milliseconds,
      startedAt: 1_000 as Milliseconds,
      pausedRemainingMs: undefined,
    });
    gateway.setFacilitator(MEMBER, 'Grace');

    const { meta } = readSnapshot(gateway);
    expect(meta.phase).toBe('vote');
    expect(meta.timer).toEqual({
      durationMs: 60_000,
      startedAt: 1_000,
      pausedRemainingMs: undefined,
    });
    expect(meta.facilitatorClientId).toBe(MEMBER);
    expect(meta.facilitatorName).toBe('Grace');

    gateway.setFacilitatorName('Grace H.');
    expect(readSnapshot(gateway).meta.facilitatorName).toBe('Grace H.');
  });
});

describe('RetroDocGateway.subscribe', () => {
  it('notifies on every committed transaction until unsubscribed', () => {
    const gateway = createGateway();
    const onChange = vi.fn();

    const unsubscribe = gateway.subscribe(onChange);
    gateway.addCard({ columnId: WENT_WELL, authorClientId: MEMBER, text: 'observed' });
    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe();
    gateway.addCard({ columnId: WENT_WELL, authorClientId: MEMBER, text: 'unobserved' });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
