import { z } from 'zod';

import type { IDocumentHistory } from './versioned-document';

const legacyBook = z.object({ schema: z.literal(1), groups: z.array(z.unknown()) });

/**
 * How the book grew. Version 1 put it under a version; version 0 is the book written before
 * that, `{ schema: 1, groups }`. Version 2 dropped the scheduled action, now always the opposite
 * of the rest of the time; reading the book leaves the old field behind. The same text travels
 * to Drive, so a book from a newer app comes back as `newer` and is never overwritten.
 */
export const BOOK_HISTORY: IDocumentHistory = {
  version: 2,
  migrations: { 0: data => ({ groups: legacyBook.parse(data).groups }), 1: data => data },
};
