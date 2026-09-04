import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import type { IRoomAwareness } from '../domain/ports/room-awareness';
import type { ClientId, ColumnId, IParticipant } from '../domain/types';
import type { UserDirectoryStore } from './UserDirectoryStore';

type PresenceDirectory = Pick<UserDirectoryStore, 'upsert'>;

const AWARENESS_USER_FIELD = 'user';
/** Republished well inside y-webrtc's ~30 s awareness timeout so peers never drop us as stale. */
const PRESENCE_HEARTBEAT_INTERVAL_MS = 10_000;

export interface IPresenceIdentity {
  readonly clientId: ClientId;
  readonly name: string;
  readonly pictureUrl?: string;
}

export interface IPresenceTrackerParams {
  readonly awareness: IRoomAwareness;
  readonly directory: PresenceDirectory;
  readonly onPresentUsersChange: (users: readonly IParticipant[]) => void;
}

interface IProfileSummary {
  readonly name: string;
  readonly pictureUrl: string | undefined;
}

/**
 * Who is in the room right now: publishes the local participant into
 * awareness with a keep-alive heartbeat, folds remote awareness states into a
 * participant list and mirrors changed profiles into the user directory.
 */
export class PresenceTracker {
  private readonly awareness: IRoomAwareness;
  private readonly directory: PresenceDirectory;
  private readonly onPresentUsersChange: (users: readonly IParticipant[]) => void;
  /** Awareness fires on every field change; the directory is written only when a profile changed. */
  private readonly lastUpsertedProfiles = new Map<ClientId, IProfileSummary>();
  private readonly handleAwarenessChange: () => void;
  private readonly heartbeatId: ReturnType<typeof setInterval>;
  private localIdentity: IPresenceIdentity | undefined;

  constructor(params: IPresenceTrackerParams) {
    this.awareness = params.awareness;
    this.directory = params.directory;
    this.onPresentUsersChange = params.onPresentUsersChange;

    this.handleAwarenessChange = (): void => {
      this.onPresentUsersChange(this.collectPresentUsers());
    };
    this.awareness.on('change', this.handleAwarenessChange);
    this.heartbeatId = setInterval(() => {
      this.republishIdentity();
    }, PRESENCE_HEARTBEAT_INTERVAL_MS);
  }

  /** Publishes the local participant and makes it the heartbeat baseline, clearing any typing marker. */
  publishIdentity(identity: IPresenceIdentity): void {
    this.localIdentity = identity;
    this.republishIdentity();
  }

  publishTyping(columnId: ColumnId | undefined): void {
    const identity = this.localIdentity;
    assert(!isNil(identity), 'presence identity must be published before typing state');
    this.publishParticipant(identity, columnId);
  }

  /** Clears the local awareness state explicitly so peers see us leave at once, not after the timeout. */
  dispose(): void {
    this.awareness.off('change', this.handleAwarenessChange);
    this.awareness.setLocalState(null);
    clearInterval(this.heartbeatId);
    this.lastUpsertedProfiles.clear();
  }

  private republishIdentity(): void {
    if (!isNil(this.localIdentity)) {
      this.publishParticipant(this.localIdentity, undefined);
    }
  }

  private publishParticipant(
    identity: IPresenceIdentity,
    typingInColumnId: ColumnId | undefined
  ): void {
    const participant: IParticipant = {
      clientId: identity.clientId,
      name: identity.name,
      pictureUrl: identity.pictureUrl,
      typingInColumnId,
    };
    this.awareness.setLocalStateField(AWARENESS_USER_FIELD, participant);
  }

  /**
   * Awareness is keyed by per-session Yjs client ids while a person has one
   * stable `clientId`; after a reconnect both entries coexist until the stale
   * one times out, so the freshest entry per `clientId` wins.
   */
  private collectPresentUsers(): readonly IParticipant[] {
    const deduped = new Map<ClientId, { user: IParticipant; lastUpdated: number }>();
    this.awareness.getStates().forEach((state, yjsClientId) => {
      const user = readParticipant(state[AWARENESS_USER_FIELD]);
      if (isNil(user)) {
        return;
      }
      const lastUpdated = this.awareness.meta.get(yjsClientId)?.lastUpdated ?? 0;
      const existing = deduped.get(user.clientId);
      if (isNil(existing) || lastUpdated >= existing.lastUpdated) {
        deduped.set(user.clientId, { user, lastUpdated });
      }
    });

    const users = Array.from(deduped.values()).map(entry => entry.user);
    this.syncDirectory(users);
    return users;
  }

  private syncDirectory(users: readonly IParticipant[]): void {
    for (const user of users) {
      const lastUpserted = this.lastUpsertedProfiles.get(user.clientId);
      if (lastUpserted?.name === user.name && lastUpserted.pictureUrl === user.pictureUrl) {
        continue;
      }
      this.lastUpsertedProfiles.set(user.clientId, {
        name: user.name,
        pictureUrl: user.pictureUrl,
      });
      void this.directory.upsert({
        clientId: user.clientId,
        name: user.name,
        pictureUrl: user.pictureUrl,
      });
    }
  }
}

function readParticipant(value: unknown): IParticipant | undefined {
  if (isNil(value) || typeof value !== 'object') {
    return undefined;
  }
  if (!('clientId' in value) || typeof value.clientId !== 'number') {
    return undefined;
  }
  if (!('name' in value) || typeof value.name !== 'string') {
    return undefined;
  }
  const pictureUrl =
    'pictureUrl' in value && typeof value.pictureUrl === 'string' ? value.pictureUrl : undefined;
  const typingInColumnId =
    'typingInColumnId' in value && typeof value.typingInColumnId === 'string'
      ? (value.typingInColumnId as ColumnId)
      : undefined;
  return { clientId: value.clientId as ClientId, name: value.name, pictureUrl, typingInColumnId };
}
