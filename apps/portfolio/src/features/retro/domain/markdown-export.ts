import type { ISO } from '@frozik/utils';
import { formatISO8601Local } from '@frozik/utils';
import { isNil } from 'lodash-es';
import type {
  CardId,
  IActionItem,
  IRetroCard,
  IRetroGroup,
  IRetroSnapshot,
  VotesByTarget,
} from './types';
import { rankTargetsByVotes } from './voting';

/**
 * Render a retrospective snapshot into a plain-markdown document ready for
 * clipboard copy or .md file download.
 *
 * Layout:
 *   # <meta.name> — <formatted date>
 *
 *   ## <Column.title> (<N cards>)
 *   ### <N votes> — <group title>
 *   - card text
 *   - card text
 *   - <ungrouped card text>
 *
 *   ## Action Items (<N>)
 *   - [ ] action text (from: <group title>)
 */
export function renderSnapshotToMarkdown(snapshot: IRetroSnapshot): string {
  const lines: string[] = [];

  lines.push(`# ${snapshot.meta.name} — ${formatIsoAsDate(snapshot.meta.createdAt)}`);
  lines.push('');

  for (const column of snapshot.columns) {
    const cardsInColumn = snapshot.cards.filter(card => card.columnId === column.id);
    const groupsInColumn = snapshot.groups.filter(group => group.columnId === column.id);

    lines.push(`## ${column.title} (${cardsInColumn.length} cards)`);
    lines.push('');

    if (cardsInColumn.length === 0) {
      lines.push('_No cards._');
      lines.push('');
      continue;
    }

    appendColumnBody(lines, cardsInColumn, groupsInColumn, snapshot.votes);
    lines.push('');
  }

  lines.push(`## Action Items (${snapshot.actionItems.length})`);
  lines.push('');

  if (snapshot.actionItems.length === 0) {
    lines.push('_No action items._');
  } else {
    for (const actionItem of snapshot.actionItems) {
      lines.push(renderActionItem(actionItem, snapshot.groups));
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

function appendColumnBody(
  lines: string[],
  cardsInColumn: readonly IRetroCard[],
  groupsInColumn: readonly IRetroGroup[],
  votes: VotesByTarget
): void {
  const groupedCardIds = new Set<CardId>();
  groupsInColumn.forEach(group => group.cardIds.forEach(cardId => groupedCardIds.add(cardId)));
  const cardById = new Map<CardId, IRetroCard>(cardsInColumn.map(card => [card.id, card]));

  const rankedGroups = rankTargetsByVotes(
    groupsInColumn.map(group => group.id),
    votes
  );

  const ungroupedCards = cardsInColumn.filter(card => !groupedCardIds.has(card.id));
  const rankedUngrouped = rankTargetsByVotes(
    ungroupedCards.map(card => card.id),
    votes
  );

  for (const { targetId: groupId, totalVotes } of rankedGroups) {
    const group = groupsInColumn.find(candidate => candidate.id === groupId);

    if (isNil(group)) {
      continue;
    }

    lines.push(`### ${formatVotes(totalVotes)} — ${escapeMarkdown(group.title)}`);

    for (const cardId of group.cardIds) {
      const card = cardById.get(cardId);

      if (!isNil(card)) {
        lines.push(`- ${escapeMarkdown(card.text)}`);
      }
    }

    lines.push('');
  }

  for (const { targetId: cardId, totalVotes } of rankedUngrouped) {
    const card = cardById.get(cardId);

    if (isNil(card)) {
      continue;
    }

    const voteTag = totalVotes > 0 ? ` _(${formatVotes(totalVotes)})_` : '';
    lines.push(`- ${escapeMarkdown(card.text)}${voteTag}`);
  }
}

function renderActionItem(actionItem: IActionItem, groups: readonly IRetroGroup[]): string {
  const sourceGroup = isNil(actionItem.sourceGroupId)
    ? undefined
    : groups.find(candidate => candidate.id === actionItem.sourceGroupId);

  const sourceSuffix = isNil(sourceGroup) ? '' : ` _(from: ${escapeMarkdown(sourceGroup.title)})_`;

  return `- [ ] ${escapeMarkdown(actionItem.text)}${sourceSuffix}`;
}

function formatVotes(count: number): string {
  return `${count} ${count === 1 ? 'vote' : 'votes'}`;
}

function formatIsoAsDate(iso: ISO): string {
  return formatISO8601Local(iso).slice(0, 10);
}

/**
 * Escape markdown-special characters in user-provided text to prevent
 * injected headings, formatting or list markers from breaking the layout.
 */
function escapeMarkdown(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/([`*_{}[\]()#+\-.!>|~])/g, '\\$1')
    .replace(/\r?\n/g, ' ');
}
