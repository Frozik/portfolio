import type { ISO, Milliseconds, Opaque } from '@frozik/utils';

export type RoomId = Opaque<'RoomId', string>;
export type CardId = Opaque<'CardId', string>;
export type GroupId = Opaque<'GroupId', string>;
export type ActionItemId = Opaque<'ActionItemId', string>;
export type ColumnId = Opaque<'ColumnId', string>;
export type ClientId = Opaque<'ClientId', number>;

export enum ERetroPhase {
  Brainstorm = 'brainstorm',
  Group = 'group',
  Vote = 'vote',
  Discuss = 'discuss',
  Close = 'close',
}

export enum ERetroTemplate {
  Scrum = 'scrum',
  MadSadGlad = 'madSadGlad',
  StartStopContinue = 'startStopContinue',
}

export interface IColumnConfig {
  id: ColumnId;
  title: string;
  emoji: string;
  color: string;
  prompt: string;
}

export interface ITemplateConfig {
  id: ERetroTemplate;
  name: string;
  description: string;
  columns: readonly IColumnConfig[];
}

export interface IRetroCard {
  id: CardId;
  authorClientId: ClientId;
  columnId: ColumnId;
  text: string;
  createdAt: ISO;
  groupId: GroupId | null;
}

export interface IRetroGroup {
  id: GroupId;
  columnId: ColumnId;
  title: string;
  cardIds: CardId[];
}

export interface IActionItem {
  id: ActionItemId;
  text: string;
  sourceGroupId: GroupId | null;
  ownerClientId: ClientId | null;
  createdAt: ISO;
}

export interface ITimerState {
  durationMs: Milliseconds;
  startedAt: Milliseconds | null;
  pausedRemainingMs: Milliseconds | null;
}

export interface IRetroMeta {
  name: string;
  createdAt: ISO;
  template: ERetroTemplate;
  phase: ERetroPhase;
  facilitatorClientId: ClientId | null;
  /** Display name of the current facilitator, kept in Yjs so it survives disconnect. */
  facilitatorName: string;
  votesPerParticipant: number;
  timer: ITimerState;
}

export interface IRoomIndexEntry {
  roomId: RoomId;
  name: string;
  template: ERetroTemplate;
  createdAt: ISO;
  lastVisitedAt: ISO;
  participantCount: number;
  /** clientId of the retro's facilitator. Resolved to a display name via `UserDirectoryStore`. */
  ownerClientId: ClientId | null;
}

export interface IParticipant {
  clientId: ClientId;
  name: string;
  color: string;
  typingInColumnId: ColumnId | null;
}

/**
 * Map of targetId (card or group) to per-client vote counts.
 * votes.get(targetId).get(clientId) = vote count
 */
export type VotesByTarget = ReadonlyMap<CardId | GroupId, ReadonlyMap<ClientId, number>>;

export interface IRetroSnapshot {
  meta: IRetroMeta;
  columns: readonly IColumnConfig[];
  cards: readonly IRetroCard[];
  groups: readonly IRetroGroup[];
  actionItems: readonly IActionItem[];
  votes: VotesByTarget;
}
