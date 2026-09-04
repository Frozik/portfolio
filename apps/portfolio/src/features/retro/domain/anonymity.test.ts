import type { ISO } from '@frozik/utils/date/types';

import {
  canMutateCard,
  countPeersTypingInColumn,
  shouldRedactCard,
  visibleCardText,
} from './anonymity';
import { REDACTED_CARD_PLACEHOLDER } from './constants';
import type { CardId, ClientId, ColumnId, IRetroCard } from './types';

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
    groupId: undefined,
    ...overrides,
  };
}

describe('shouldRedactCard', () => {
  it('redacts others cards during brainstorm', () => {
    const card = makeCard();

    expect(shouldRedactCard(card, 'brainstorm', BOB)).toBe(true);
  });

  it('does not redact the viewer own card in brainstorm', () => {
    const card = makeCard();

    expect(shouldRedactCard(card, 'brainstorm', ALICE)).toBe(false);
  });

  it('does not redact anyone past brainstorm', () => {
    const card = makeCard();

    expect(shouldRedactCard(card, 'group', BOB)).toBe(false);
    expect(shouldRedactCard(card, 'vote', BOB)).toBe(false);
    expect(shouldRedactCard(card, 'discuss', BOB)).toBe(false);
    expect(shouldRedactCard(card, 'close', BOB)).toBe(false);
  });
});

describe('visibleCardText', () => {
  it('returns placeholder for redacted cards', () => {
    const card = makeCard({ text: 'secret wisdom' });

    expect(visibleCardText(card, 'brainstorm', BOB)).toBe(REDACTED_CARD_PLACEHOLDER);
  });

  it('returns real text when viewer is the author', () => {
    const card = makeCard({ text: 'my own note' });

    expect(visibleCardText(card, 'brainstorm', ALICE)).toBe('my own note');
  });

  it('returns real text for everyone post-reveal', () => {
    const card = makeCard({ text: 'visible to all' });

    expect(visibleCardText(card, 'group', BOB)).toBe('visible to all');
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
    const participants = [{ clientId: BOB, typingInColumnId: undefined }];

    expect(countPeersTypingInColumn(participants, COLUMN_WENT_WELL, ALICE)).toBe(0);
  });
});
