import type { GroupBook } from '../../grouping/domain/group-book';
import { bookOf, custom, NOW } from '../../grouping/testing/group-book-fixtures';
import type { ICloudCopy, TCloudFailure, TCloudRev } from '../domain/ports/cloud-copy';
import type { ISyncMemory } from '../domain/ports/sync-store';
import { SyncModel } from './SyncModel';

const ids = (book: GroupBook) => book.groups.map(group => group.id);

class FakeCloud implements ICloudCopy {
  book: GroupBook | null = null;
  revision = 0;
  unreadable = false;
  failure: TCloudFailure | null = null;
  /** Another phone writes right before this many of our writes land. */
  racesLeft = 0;
  writes = 0;

  async read() {
    if (this.failure !== null) {
      return { kind: 'failed' as const, failure: this.failure };
    }
    if (this.unreadable) {
      return { kind: 'unreadable' as const, rev: String(this.revision) as TCloudRev };
    }
    return this.book === null
      ? { kind: 'absent' as const }
      : { kind: 'found' as const, book: this.book, rev: String(this.revision) as TCloudRev };
  }

  async write(book: GroupBook, rev: TCloudRev | null) {
    if (this.racesLeft > 0) {
      this.racesLeft -= 1;
      this.revision += 1;
      return { kind: 'conflict' as const };
    }
    if (
      (rev === null) !== (this.book === null) ||
      (rev !== null && rev !== String(this.revision))
    ) {
      return { kind: 'conflict' as const };
    }
    this.book = book;
    this.revision += 1;
    this.writes += 1;
    return { kind: 'written' as const, rev: String(this.revision) as TCloudRev };
  }
}

function phone(cloud: ICloudCopy, initial: GroupBook) {
  let current = initial;
  let memory: ISyncMemory = { connection: { account: 'me@example.com' }, base: null };
  const sync = new SyncModel(
    {
      cloudOf: () => cloud,
      store: {
        load: async () => memory,
        save: async next => {
          memory = next;
        },
      },
      google: {
        connect: async () => ({ kind: 'connected', account: 'me@example.com' }),
        disconnect: async () => {},
      },
      clock: {
        now: () => NOW,
        localNow: () => NOW.toZonedDateTimeISO('UTC').toPlainDateTime(),
        timeZone: () => 'UTC',
      },
      diagnostics: { log: () => {}, latest: () => [] },
    },
    {
      book: () => current,
      replace: book => {
        current = book;
      },
    }
  );
  return {
    sync,
    book: () => current,
    edit: (book: GroupBook) => {
      current = book;
    },
  };
}

describe('keeping the group book in the cloud', () => {
  it("puts this phone's book into an empty cloud", async () => {
    const cloud = new FakeCloud();
    const mine = phone(cloud, bookOf([custom('spam', [])]));
    await mine.sync.load();
    await mine.sync.syncNow();
    expect(cloud.book === null ? [] : ids(cloud.book)).toContain('spam');
    expect(mine.sync.state.kind).toBe('synced');
  });

  it('brings two phones to the same book', async () => {
    const cloud = new FakeCloud();
    const first = phone(cloud, bookOf([custom('spam', [])]));
    const second = phone(cloud, bookOf([custom('work', [])]));
    await first.sync.load();
    await second.sync.load();
    await first.sync.syncNow();
    await second.sync.syncNow();
    await first.sync.syncNow();
    expect(ids(first.book())).toEqual(ids(second.book()));
    expect(ids(first.book())).toEqual(expect.arrayContaining(['spam', 'work']));
  });

  it('reads and merges again when another phone wrote in between', async () => {
    const cloud = new FakeCloud();
    const mine = phone(cloud, bookOf([custom('spam', [])]));
    await mine.sync.load();
    cloud.book = bookOf([custom('work', [])]);
    cloud.racesLeft = 1;
    await mine.sync.syncNow();
    expect(mine.sync.state.kind).toBe('synced');
    expect(ids(mine.book())).toEqual(expect.arrayContaining(['spam', 'work']));
  });

  it('never writes over a cloud file it cannot read', async () => {
    const cloud = new FakeCloud();
    cloud.unreadable = true;
    const mine = phone(cloud, bookOf([custom('spam', [])]));
    await mine.sync.load();
    await mine.sync.syncNow();
    expect(mine.sync.state.kind).toBe('unreadable');
    expect(cloud.writes).toBe(0);
  });

  it("keeps the phone's book as it is while offline", async () => {
    const cloud = new FakeCloud();
    cloud.failure = 'offline';
    const book = bookOf([custom('spam', [])]);
    const mine = phone(cloud, book);
    await mine.sync.load();
    await mine.sync.syncNow();
    expect(mine.sync.state).toMatchObject({ kind: 'failed', failure: 'offline' });
    expect(mine.book()).toBe(book);
  });

  it('does nothing until an account is connected', async () => {
    const cloud = new FakeCloud();
    const mine = phone(cloud, bookOf([]));
    await mine.sync.disconnect();
    await mine.sync.syncNow();
    expect(cloud.writes).toBe(0);
    expect(mine.sync.state.kind).toBe('off');
  });
});
