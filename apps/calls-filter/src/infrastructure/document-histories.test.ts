import { BOOK_HISTORY } from './codecs/group-book-history';
import { gapsIn } from './codecs/versioned-document';
import { CALENDARS_DOCUMENT } from './sqlite-calendar-store';
import { PREFERENCES_DOCUMENT } from './sqlite-preferences-store';
import { SYNC_DOCUMENT } from './sqlite-sync-store';

describe('the stored documents', () => {
  it.each([
    ['the group book', BOOK_HISTORY],
    ['the preferences', PREFERENCES_DOCUMENT.history],
    ['the calendars', CALENDARS_DOCUMENT.history],
    ['the sync memory', SYNC_DOCUMENT.history],
  ])('%s has a step from every version before its own', (_name, history) => {
    expect(gapsIn(history)).toEqual([]);
  });
});
