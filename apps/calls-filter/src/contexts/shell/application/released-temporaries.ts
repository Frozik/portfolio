import type { GroupBookStore } from '../../grouping/application/GroupBookStore';
import { setTemporaryPolicy } from '../../grouping/domain/group-book-edits';

/**
 * A temporary policy the service released — used up by its first call, or taken back from the
 * shade — comes off the group, on every phone. The service names each as `group@setAt` in epoch ms.
 */
export function dropReleasedTemporaries(books: GroupBookStore, released: readonly string[]): void {
  const keys = new Set(released);
  for (const group of books.book.groups) {
    const { temporary } = group;
    if (temporary !== null && keys.has(`${group.id}@${temporary.setAt.epochMilliseconds}`)) {
      books.run((book, context) => setTemporaryPolicy(book, group.id, null, context.now));
    }
  }
}
