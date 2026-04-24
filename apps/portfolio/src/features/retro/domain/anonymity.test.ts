import type { ISO } from '@frozik/utils/date/types';

import {
  canMutateCard,
  countPeersTypingInColumn,
  shouldRedactCard,
  visibleCardText,
} from './anonymity';
import { REDACTED_CARD_PLACEHOLDER } from './constants';
import type { CardId, ClientId, ColumnId, IRetroCard } from './types';
import { ERetroPhase } from './types';

const ALICE = 1 as ClientId;
const BOB = 2 as ClientId;

const COLUMN_WENT_WELL = 'col-1' as ColumnId;

function makeCard(overrides: Partial<IRetroCard> = {}): IRetroCard {
  return {
    id: 'card-1' as CardId,
    authorClientId: ALICE,
    columnId: COLUMN_WENT_WELL,
    text: 'Shipped the feature on time',
    createdAt: '2026-04-18T10:00:00Z' as ISO,
    groupId: null,
    ...overrides,
  };
}

describe('shouldRedactCard', () => {
  it('redacts others cards during brainstorm', () => {
    const card = makeCard();

    expect(shouldRedactCard(card, ERetroPhase.Brainstorm, BOB)).toBe(true);
  });

  it('does not redact the viewer own card in brainstorm', () => {
    const card = makeCard();

    expect(shouldRedactCard(card, ERetroPhase.Brainstorm, ALICE)).toBe(false);
  });

  it('does not redact anyone past brainstorm', () => {
    const card = makeCard();

    expect(shouldRedactCard(card, ERetroPhase.Group, BOB)).toBe(false);
    expect(shouldRedactCard(card, ERetroPhase.Vote, BOB)).toBe(false);
    expect(shouldRedactCard(card, ERetroPhase.Discuss, BOB)).toBe(false);
    expect(shouldRedactCard(card, ERetroPhase.Close, BOB)).toBe(false);
  });
});

describe('visibleCardText', () => {
  it('returns placeholder for redacted cards', () => {
    const card = makeCard({ text: 'secret wisdom' });

    expect(visibleCardText(card, ERetroPhase.Brainstorm, BOB)).toBe(REDACTED_CARD_PLACEHOLDER);
  });

  it('returns real text when viewer is the author', () => {
    const card = makeCard({ text: 'my own note' });

    expect(visibleCardText(card, ERetroPhase.Brainstorm, ALICE)).toBe('my own note');
  });

  it('returns real text for everyone post-reveal', () => {
    const card = makeCard({ text: 'visible to all' });

    expect(visibleCardText(card, ERetroPhase.Group, BOB)).toBe('visible to all');
  });
});

describe('canMutateCard', () => {
  it('authors may mutate their own cards', () => {
    expect(canMutateCard(makeCard(), ALICE)).toBe(true);
  });

  it('others may not mutate someone else cards', () => {
    expect(canMutateCard(makeCard(), BOB)).toBe(false);
  });
});

describe('countPeersTypingInColumn', () => {
  it('ignores the viewer own typing state', () => {
    const participants = [
      { clientId: ALICE, typingInColumnId: COLUMN_WENT_WELL },
      { clientId: BOB, typingInColumnId: COLUMN_WENT_WELL },
    ];

    expect(countPeersTypingInColumn(participants, COLUMN_WENT_WELL, ALICE)).toBe(1);
  });

  it('counts only peers typing in the target column', () => {
    const OTHER_COLUMN = 'col-2' as ColumnId;
    const CAROL = 3 as ClientId;

    const participants = [
      { clientId: BOB, typingInColumnId: COLUMN_WENT_WELL },
      { clientId: CAROL, typingInColumnId: OTHER_COLUMN },
    ];

    expect(countPeersTypingInColumn(participants, COLUMN_WENT_WELL, ALICE)).toBe(1);
  });

  it('returns 0 when no peer is typing', () => {
    const participants = [{ clientId: BOB, typingInColumnId: null }];

    expect(countPeersTypingInColumn(participants, COLUMN_WENT_WELL, ALICE)).toBe(0);
  });
});
