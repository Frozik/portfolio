import type { GroupBook } from '../../../grouping/domain/group-book';

/** The Google account the book is kept with; Google does not always say its address. */
export interface ISyncConnection {
  readonly account: string | null;
}

/** What sync keeps on this phone: the connection, and the book as it was at the last sync. */
export interface ISyncMemory {
  readonly connection: ISyncConnection | null;
  readonly base: GroupBook | null;
}

export interface ISyncStore {
  load(): Promise<ISyncMemory>;
  save(memory: ISyncMemory): Promise<void>;
}
