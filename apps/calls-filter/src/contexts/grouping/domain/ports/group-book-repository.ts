import type { GroupBook } from '../group-book';

/** Where the book lives on the phone: the one place it is saved and read back from. */
export interface IGroupBookRepository {
  load(): Promise<GroupBook | null>;
  save(book: GroupBook): Promise<void>;
}
