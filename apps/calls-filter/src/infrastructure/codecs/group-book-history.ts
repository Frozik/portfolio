import type { IDocumentHistory } from './versioned-document';

/**
 * How the book grew; a change of shape adds a step here. The same text travels to Drive, so a
 * book from a newer app comes back as `newer` and is never overwritten.
 */
export const BOOK_HISTORY: IDocumentHistory = { version: 1, migrations: {} };
