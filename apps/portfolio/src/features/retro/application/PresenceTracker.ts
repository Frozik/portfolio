import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import type { ClientId, ColumnId, IParticipant } from '../domain/types';
import type { IYjsRoomProviders } from '../infrastructure/yjs-providers';
import type { UserDirectoryStore } from './UserDirectoryStore';

type RoomAwareness = IYjsRoomProviders['webrtc']['awareness'];

const AWARENESS_USER_FIELD = 'user';

/**
 * Keep awareness alive: republish every 10s so peers never drop us as
 * stale (awareness default timeout is ~30s on most y-webrtc setups).
 */
const PRESENCE_HEARTBEAT_INTERVAL_MS = 10_000;

export interface IPresenceIdentity {
  readonly clientId: ClientId;
  readonly name: string;
  readonly pictureUrl?: string;
}

export interface IPresenceTrackerParams {
  readonly awareness: RoomAwareness;
  readonly directory: UserDirectoryStore;
  readonly onPresentUsersChange: (users: readonly IParticipant[]) => void;
}

/**
 * Owns everything about "who is in this room right now": publishing the
 * local participant into awareness (plus the keep-alive heartbeat),
 * deduplicating remote awareness states into a participant list, and
 * mirroring changed profiles into the shared user directory.
 */
export class PresenceTracker {
  private readonly awareness: RoomAwareness;
  private readonly directory: UserDirectoryStore;
  private readonly onPresentUsersChange: (users: readonly IParticipant[]) => void;
  /**
   * Last name/avatar we wrote to the directory per clientId. Awareness fires
   * on every field change (including typing focus/blur that never touches
   * identity), so we compare against this map and only re-`upsert` when a
   * user's display name or picture actually changed — avoiding an IndexedDB
   * write on every awareness tick.
   */
  private readonly lastUpsertedProfiles = new Map<
    ClientId,
    { readonly name: string; readonly pictureUrl: string | undefined }
  >();
  private readonly handleAwarenessChange: () => void;
  private localIdentity: IPresenceIdentity | null = null;
  private heartbeatId: ReturnType<typeof setInterval> | null = null;

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

  /**
   * Publish (and remember as the heartbeat baseline) the local participant.
   * Any in-flight typing marker is cleared — the baseline is identity-only.
   */
  publishIdentity(identity: IPresenceIdentity): void {
    this.localIdentity = identity;
    this.republishIdentity();
  }

  /** Publish the transient "typing in column" marker on top of the identity. */
  publishTyping(columnId: ColumnId | null): void {
    const identity = this.localIdentity;
    assert(!isNil(identity), 'presence identity must be published before typing state');
    this.publishParticipant(identity, columnId);
  }

  dispose(): void {
    this.awareness.off('change', this.handleAwarenessChange);
    // Explicitly clear awareness before disconnecting so other peers see
    // us leave instantly instead of waiting for the default 30s timeout.
    // Without this, a quick rejoin produces a duplicate user entry on
    // peers until the stale awareness state expires.
    try {
      this.awareness.setLocalState(null);
    } catch {
      // awareness may already be torn down — ignore.
    }
    if (this.heartbeatId !== null) {
      clearInterval(this.heartbeatId);
      this.heartbeatId = null;
    }
    this.lastUpsertedProfiles.clear();
  }

  private republishIdentity(): void {
    const identity = this.localIdentity;
    if (isNil(identity)) {
      return;
    }
    this.publishParticipant(identity, null);
  }

  private publishParticipant(identity: IPresenceIdentity, typingInColumnId: ColumnId | null): void {
    const participant: IParticipant = {
      clientId: identity.clientId,
      name: identity.name,
      pictureUrl: identity.pictureUrl,
      typingInColumnId,
    };
    this.awareness.setLocalStateField(AWARENESS_USER_FIELD, participant);
  }

  private collectPresentUsers(): readonly IParticipant[] {
    const states = this.awareness.getStates();
    const meta = this.awareness.meta as Map<number, { lastUpdated: number }>;

    // Awareness is keyed by per-session Yjs client ids, but our user
    // identity has its own stable `clientId` (from localStorage). When the
    // same person reconnects they appear twice until the stale awareness
    // entry times out — dedupe here by identity.clientId, keeping the
    // entry with the freshest `lastUpdated` meta.
    const deduped = new Map<ClientId, { user: IParticipant; lastUpdated: number }>();
    states.forEach((state, yjsClientId) => {
      const user = (state as { user?: IParticipant }).user;
      if (user === undefined) {
        return;
      }
      const lastUpdated = meta.get(yjsClientId)?.lastUpdated ?? 0;
      const existing = deduped.get(user.clientId);
      if (existing === undefined || lastUpdated >= existing.lastUpdated) {
        deduped.set(user.clientId, { user, lastUpdated });
      }
    });

    const users = Array.from(deduped.values()).map(entry => entry.user);
    this.syncDirectory(users);
    return users;
  }

  private syncDirectory(users: readonly IParticipant[]): void {
    users.forEach(user => {
      const lastUpserted = this.lastUpsertedProfiles.get(user.clientId);
      if (
        lastUpserted !== undefined &&
        lastUpserted.name === user.name &&
        lastUpserted.pictureUrl === user.pictureUrl
      ) {
        return;
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
    });
  }
}
