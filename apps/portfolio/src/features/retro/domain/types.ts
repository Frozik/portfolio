import type { ISO, Milliseconds } from '@frozik/utils/date/types';
import type { Opaque } from '@frozik/utils/types/base';

export type RoomId = Opaque<'RoomId', string>;
export type CardId = Opaque<'CardId', string>;
export type GroupId = Opaque<'GroupId', string>;
export type ActionItemId = Opaque<'ActionItemId', string>;
export type ColumnId = Opaque<'ColumnId', string>;
export type ClientId = Opaque<'ClientId', number>;

const RETRO_PHASES = ['brainstorm', 'group', 'vote', 'discuss', 'close'] as const;
export type RetroPhase = (typeof RETRO_PHASES)[number];

export interface IColumnConfig {
  readonly id: ColumnId;
  readonly title: string;
  readonly emoji: string;
  readonly color: string;
  readonly prompt: string;
}

export interface ITemplateConfig {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly columns: readonly IColumnConfig[];
}

export interface IRetroCard {
  readonly id: CardId;
  readonly authorClientId: ClientId;
  readonly columnId: ColumnId;
  readonly text: string;
  readonly createdAt: ISO;
  readonly groupId: GroupId | undefined;
}

export interface IRetroGroup {
  readonly id: GroupId;
  readonly columnId: ColumnId;
  readonly title: string;
  readonly cardIds: readonly CardId[];
}

export interface IActionItem {
  readonly id: ActionItemId;
  readonly text: string;
  readonly sourceGroupId: GroupId | undefined;
  readonly ownerClientId: ClientId | undefined;
  readonly createdAt: ISO;
}

export interface ITimerState {
  readonly durationMs: Milliseconds;
  readonly startedAt: Milliseconds | undefined;
  readonly pausedRemainingMs: Milliseconds | undefined;
}

export interface IRetroMeta {
  readonly name: string;
  readonly createdAt: ISO;
  readonly template: string;
  readonly phase: RetroPhase;
  readonly facilitatorClientId: ClientId | undefined;
  /** Display name of the current facilitator, kept in the doc so it survives disconnect. */
  readonly facilitatorName: string;
  readonly votesPerParticipant: number;
  readonly timer: ITimerState;
}

export interface IRoomIndexEntry {
  readonly roomId: RoomId;
  readonly name: string;
  readonly template: string;
  readonly createdAt: ISO;
  readonly lastVisitedAt: ISO;
  readonly participantCount: number;
  /** clientId of the retro's facilitator, resolved to a display name via `UserDirectoryStore`. */
  readonly ownerClientId: ClientId | undefined;
  /** Phase at the moment of the last visit; unknown for rows written before phase was tracked. */
  readonly phase: RetroPhase | undefined;
  /** Every clientId ever seen in this room via awareness, oldest first. */
  readonly knownParticipantIds: readonly ClientId[];
}

export interface IParticipant {
  readonly clientId: ClientId;
  readonly name: string;
  readonly pictureUrl?: string;
  readonly typingInColumnId: ColumnId | undefined;
}

/** `votes.get(targetId).get(clientId)` is that client's vote count on a card or group. */
export type VotesByTarget = ReadonlyMap<CardId | GroupId, ReadonlyMap<ClientId, number>>;

export interface IRetroSnapshot {
  readonly meta: IRetroMeta;
  readonly columns: readonly IColumnConfig[];
  readonly cards: readonly IRetroCard[];
  readonly groups: readonly IRetroGroup[];
  readonly actionItems: readonly IActionItem[];
  readonly votes: VotesByTarget;
}
