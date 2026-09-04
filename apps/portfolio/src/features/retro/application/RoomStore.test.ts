import { when } from 'mobx';
import * as Y from 'yjs';

import { getTemplateById } from '../domain/templates';
import type { ClientId, RoomId } from '../domain/types';
import { RetroDocGateway } from '../infrastructure/RetroDocGateway';
import type { IYjsRoomProviders } from '../infrastructure/yjs-providers';
import { FakeRoomAwareness } from './fake-room-awareness.test-helper';
import type { IJoinedRoomSnapshot } from './RetroLobbyStore';
import type { RoomStore as RoomStoreType } from './RoomStore';
import { RoomStore } from './RoomStore';

const ROOM_ID = 'room-1' as RoomId;
const ADA = 1 as ClientId;
const BOB = 2 as ClientId;
const YJS_ADA = 101;
const YJS_BOB = 202;
const VOTES_PER_PARTICIPANT = 3;

const SILENT_PLAYER = { play(): void {}, dispose(): void {} };

interface IHarness {
  readonly doc: Y.Doc;
  readonly awareness: FakeRoomAwareness;
  readonly upserted: IJoinedRoomSnapshot[];
  readonly destroyed: { count: number };
  openAs(clientId: ClientId, create: boolean): RoomStoreType;
}

function createHarness(): IHarness {
  const doc = new Y.Doc();
  const awareness = new FakeRoomAwareness(YJS_ADA);
  const upserted: IJoinedRoomSnapshot[] = [];
  const destroyed = { count: 0 };
  const providers: IYjsRoomProviders = {
    doc,
    awareness,
    whenSynced: () => Promise.resolve(),
    destroy: () => {
      destroyed.count += 1;
    },
  };
  return {
    doc,
    awareness,
    upserted,
    destroyed,
    openAs(clientId, create) {
      return new RoomStore({
        roomId: ROOM_ID,
        identity: { clientId, name: clientId === ADA ? 'Ada' : 'Bob' },
        providers,
        createIfMissing: create
          ? {
              name: 'Sprint 42',
              template: getTemplateById('scrum-en'),
              votesPerParticipant: VOTES_PER_PARTICIPANT,
            }
          : undefined,
        directory: { upsert: () => Promise.resolve(), seedIfMissing: () => Promise.resolve() },
        lobby: {
          upsertJoinedRoom: snapshot => {
            upserted.push(snapshot);
            return Promise.resolve();
          },
        },
        soundPlayer: SILENT_PLAYER,
      });
    },
  };
}

async function whenSynced(store: RoomStoreType): Promise<void> {
  await when(() => store.connectionStatus !== 'connecting');
}

describe('RoomStore', () => {
  it('creates the doc on first sync and seats the creator as facilitator', async () => {
    const harness = createHarness();
    const store = harness.openAs(ADA, true);

    await whenSynced(store);

    expect(store.connectionStatus).toBe('synced');
    expect(store.isFacilitator).toBe(true);
    expect(store.phase).toBe('brainstorm');
    expect(store.currentSnapshot?.meta.name).toBe('Sprint 42');
    store.dispose();
  });

  it('opens an existing room as a member without rewriting it', async () => {
    const harness = createHarness();
    const creator = harness.openAs(ADA, true);
    await whenSynced(creator);
    creator.setPhase('vote');
    creator.dispose();

    const member = harness.openAs(BOB, false);
    await whenSynced(member);

    expect(member.isFacilitator).toBe(false);
    expect(member.phase).toBe('vote');
    member.dispose();
  });

  it('lets only the facilitator step through the phases, in order', async () => {
    const harness = createHarness();
    const facilitator = harness.openAs(ADA, true);
    const member = harness.openAs(BOB, false);
    await whenSynced(facilitator);
    await whenSynced(member);

    member.advancePhase();
    expect(facilitator.phase).toBe('brainstorm');

    facilitator.advancePhase();
    expect(member.phase).toBe('group');
    facilitator.rewindPhase();
    facilitator.rewindPhase();
    expect(member.phase).toBe('brainstorm');

    facilitator.dispose();
    member.dispose();
  });

  it('reflects doc edits from any peer in the snapshot', async () => {
    const harness = createHarness();
    const store = harness.openAs(ADA, true);
    await whenSynced(store);
    const column = getTemplateById('scrum-en').columns[0];

    new RetroDocGateway(harness.doc).addCard({
      columnId: column.id,
      authorClientId: BOB,
      text: 'From Bob',
    });

    expect(store.currentSnapshot?.cards.map(card => card.text)).toEqual(['From Bob']);
    store.dispose();
  });

  it('publishes itself into awareness and lists everyone present', async () => {
    const harness = createHarness();
    const store = harness.openAs(ADA, true);
    await whenSynced(store);

    harness.awareness.setRemoteState(YJS_BOB, {
      user: { clientId: BOB, name: 'Bob', typingInColumnId: undefined },
    });

    expect(harness.awareness.localState?.user).toMatchObject({ clientId: ADA, name: 'Ada' });
    expect(store.presentParticipantIds).toEqual([ADA, BOB]);
    store.dispose();
  });

  it('records the room in the lobby index once synced', async () => {
    const harness = createHarness();
    const store = harness.openAs(ADA, true);
    await whenSynced(store);

    expect(harness.upserted.at(-1)).toMatchObject({
      roomId: ROOM_ID,
      name: 'Sprint 42',
      facilitatorClientId: ADA,
      phase: 'brainstorm',
    });
    store.dispose();
  });

  it('fails visibly when the providers never sync', async () => {
    const harness = createHarness();
    const store = new RoomStore({
      roomId: ROOM_ID,
      identity: { clientId: ADA, name: 'Ada' },
      providers: {
        doc: harness.doc,
        awareness: harness.awareness,
        whenSynced: () => Promise.reject(new Error('offline')),
        destroy: () => {},
      },
      createIfMissing: undefined,
      directory: { upsert: () => Promise.resolve(), seedIfMissing: () => Promise.resolve() },
      lobby: { upsertJoinedRoom: () => Promise.resolve() },
      soundPlayer: SILENT_PLAYER,
    });

    await whenSynced(store);

    expect(store.connectionStatus).toBe('failed');
    expect(store.currentSnapshot).toBeUndefined();
    store.dispose();
  });

  it('leaves awareness and destroys the providers once on dispose', async () => {
    const harness = createHarness();
    const store = harness.openAs(ADA, true);
    await whenSynced(store);

    store.dispose();
    store.dispose();

    expect(harness.awareness.localState).toBeUndefined();
    expect(harness.destroyed.count).toBe(1);
    expect(store.connectionStatus).toBe('disposed');
  });
});
