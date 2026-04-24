import type { ISO, Milliseconds } from '@frozik/utils/date/types';

import { renderSnapshotToMarkdown } from './markdown-export';
import type {
  ActionItemId,
  CardId,
  ClientId,
  ColumnId,
  GroupId,
  IActionItem,
  IColumnConfig,
  IRetroCard,
  IRetroGroup,
  IRetroSnapshot,
  VotesByTarget,
} from './types';
import { ERetroPhase } from './types';

const ALICE = 1 as ClientId;
const BOB = 2 as ClientId;
const CAROL = 3 as ClientId;

const COLUMN_WENT_WELL = 'col-went-well' as ColumnId;
const COLUMN_TO_IMPROVE = 'col-to-improve' as ColumnId;

const CARD_ONE = 'card-1' as CardId;
const CARD_TWO = 'card-2' as CardId;
const CARD_THREE = 'card-3' as CardId;

const GROUP_ONE = 'group-1' as GroupId;

const ACTION_ITEM_ONE = 'action-1' as ActionItemId;

const ISO_CREATED_AT = '2026-04-20T10:00:00.000Z' as ISO;
const ISO_CARD_CREATED_AT = '2026-04-20T10:05:00.000Z' as ISO;

const COLUMNS: readonly IColumnConfig[] = [
  {
    id: COLUMN_WENT_WELL,
    title: 'Went Well',
    emoji: ':)',
    color: '#00ff00',
    prompt: 'What went well?',
  },
  {
    id: COLUMN_TO_IMPROVE,
    title: 'To Improve',
    emoji: ':(',
    color: '#ff0000',
    prompt: 'What to improve?',
  },
];

function makeCard(id: CardId, columnId: ColumnId, text: string, author: ClientId): IRetroCard {
  return {
    id,
    authorClientId: author,
    columnId,
    text,
    createdAt: ISO_CARD_CREATED_AT,
    groupId: null,
  };
}

function makeVotes(
  entries: readonly [CardId | GroupId, ReadonlyArray<readonly [ClientId, number]>][]
): VotesByTarget {
  const result = new Map<CardId | GroupId, Map<ClientId, number>>();

  for (const [target, clientVotes] of entries) {
    result.set(target, new Map(clientVotes));
  }

  return result;
}

function makeSnapshot(overrides: {
  cards?: readonly IRetroCard[];
  groups?: readonly IRetroGroup[];
  actionItems?: readonly IActionItem[];
  votes?: VotesByTarget;
}): IRetroSnapshot {
  return {
    meta: {
      name: 'Sprint 42 Retro',
      createdAt: ISO_CREATED_AT,
      template: 'scrum-en',
      phase: ERetroPhase.Close,
      facilitatorClientId: ALICE,
      facilitatorName: 'Alice',
      votesPerParticipant: 5,
      timer: {
        durationMs: 0 as Milliseconds,
        startedAt: null,
        pausedRemainingMs: null,
      },
    },
    columns: COLUMNS,
    cards: overrides.cards ?? [],
    groups: overrides.groups ?? [],
    actionItems: overrides.actionItems ?? [],
    votes: overrides.votes ?? makeVotes([]),
  };
}

describe('renderSnapshotToMarkdown', () => {
  it('sorts cards within a column by total votes, descending', () => {
    const snapshot = makeSnapshot({
      cards: [
        makeCard(CARD_ONE, COLUMN_WENT_WELL, 'one vote card', ALICE),
        makeCard(CARD_TWO, COLUMN_WENT_WELL, 'three votes card', BOB),
        makeCard(CARD_THREE, COLUMN_WENT_WELL, 'two votes card', CAROL),
      ],
      votes: makeVotes([
        [CARD_ONE, [[ALICE, 1]]],
        [
          CARD_TWO,
          [
            [ALICE, 2],
            [BOB, 1],
          ],
        ],
        [CARD_THREE, [[CAROL, 2]]],
      ]),
    });

    const markdown = renderSnapshotToMarkdown(snapshot);
    const indexThree = markdown.indexOf('three votes card');
    const indexTwo = markdown.indexOf('two votes card');
    const indexOne = markdown.indexOf('one vote card');

    expect(indexThree).toBeGreaterThan(-1);
    expect(indexTwo).toBeGreaterThan(indexThree);
    expect(indexOne).toBeGreaterThan(indexTwo);
  });

  it('renders empty columns with a placeholder', () => {
    const snapshot = makeSnapshot({});

    const markdown = renderSnapshotToMarkdown(snapshot);

    expect(markdown).toContain('## Went Well (0 cards)');
    expect(markdown).toContain('## To Improve (0 cards)');
    expect(markdown).toContain('_No cards._');
  });

  it('never includes author names', () => {
    const snapshot = makeSnapshot({
      cards: [makeCard(CARD_ONE, COLUMN_WENT_WELL, 'sample card', ALICE)],
    });

    const markdown = renderSnapshotToMarkdown(snapshot);

    expect(markdown).not.toMatch(/author/i);
    expect(markdown).not.toMatch(/client/i);
    expect(markdown).not.toContain(`authorClientId`);
  });

  it('renders action items using GitHub-style task list markers', () => {
    const actionItem: IActionItem = {
      id: ACTION_ITEM_ONE,
      text: 'Ship markdown export',
      sourceGroupId: null,
      ownerClientId: null,
      createdAt: ISO_CREATED_AT,
    };

    const snapshot = makeSnapshot({
      actionItems: [actionItem],
    });

    const markdown = renderSnapshotToMarkdown(snapshot);

    expect(markdown).toContain('## Action Items (1)');
    expect(markdown).toContain('- [ ] Ship markdown export');
  });

  it('renders a placeholder when there are no action items', () => {
    const snapshot = makeSnapshot({});

    const markdown = renderSnapshotToMarkdown(snapshot);

    expect(markdown).toContain('## Action Items (0)');
    expect(markdown).toContain('_No action items._');
  });

  it('renders a vote-heavy card in a grouped section', () => {
    const group: IRetroGroup = {
      id: GROUP_ONE,
      columnId: COLUMN_WENT_WELL,
      title: 'Top theme',
      cardIds: [CARD_ONE, CARD_TWO],
    };

    const snapshot = makeSnapshot({
      cards: [
        makeCard(CARD_ONE, COLUMN_WENT_WELL, 'First grouped card', ALICE),
        makeCard(CARD_TWO, COLUMN_WENT_WELL, 'Second grouped card', BOB),
      ],
      groups: [group],
      votes: makeVotes([
        [
          GROUP_ONE,
          [
            [ALICE, 2],
            [BOB, 1],
          ],
        ],
      ]),
    });

    const markdown = renderSnapshotToMarkdown(snapshot);

    expect(markdown).toContain('### 3 votes — Top theme');
    expect(markdown).toContain('- First grouped card');
    expect(markdown).toContain('- Second grouped card');
  });

  it('annotates the top card with 3 or more votes', () => {
    const snapshot = makeSnapshot({
      cards: [
        makeCard(CARD_ONE, COLUMN_WENT_WELL, 'top card text', ALICE),
        makeCard(CARD_TWO, COLUMN_WENT_WELL, 'runner-up card text', BOB),
      ],
      votes: makeVotes([
        [
          CARD_ONE,
          [
            [ALICE, 2],
            [BOB, 1],
          ],
        ],
        [CARD_TWO, [[CAROL, 1]]],
      ]),
    });

    const markdown = renderSnapshotToMarkdown(snapshot);

    // Top card must have at least 3 total votes — rendered with its vote tag.
    expect(markdown).toContain('top card text');
    expect(markdown).toMatch(/top card text.*3 votes/);
  });
});
