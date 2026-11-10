import { Temporal } from 'temporal-polyfill';
import { z } from 'zod';

import type { TIcsId } from '../contexts/calendars/domain/calendar-source';
import type { IIcsSubscription } from '../contexts/calendars/domain/ics-subscription';
import type { ICalendarStore } from '../contexts/calendars/domain/ports/calendar-store';
import type { IDiagnosticsLog } from '../contexts/diagnostics/domain/ports/diagnostics-log';
import type { SqliteStore } from './sqlite-store';
import type { IStoredDocument } from './stored-document';
import { loadDocument, saveDocument } from './stored-document';

const instant = z
  .string()
  .nullable()
  .transform(text => (text === null ? null : Temporal.Instant.from(text)));

const settings = z.object({
  subscriptions: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      url: z.string(),
      body: z.string().nullable(),
      etag: z.string().nullable(),
      refreshedAt: instant,
      failedAt: instant,
    })
  ),
});

export const CALENDARS_DOCUMENT: IStoredDocument<readonly IIcsSubscription[]> = {
  key: 'calendars',
  history: { version: 1, migrations: {} },
  parse: data => {
    const parsed = settings.safeParse(data);
    return parsed.success
      ? parsed.data.subscriptions.map(subscription => ({
          ...subscription,
          id: subscription.id as TIcsId,
        }))
      : null;
  },
};

export function sqliteCalendarStore(
  store: SqliteStore,
  diagnostics: IDiagnosticsLog
): ICalendarStore {
  return {
    load: async () => ({
      subscriptions: (await loadDocument(store, CALENDARS_DOCUMENT, diagnostics)) ?? [],
    }),
    save: value =>
      saveDocument(store, CALENDARS_DOCUMENT, {
        subscriptions: value.subscriptions.map(subscription => ({
          ...subscription,
          refreshedAt: subscription.refreshedAt?.toString() ?? null,
          failedAt: subscription.failedAt?.toString() ?? null,
        })),
      }),
  };
}
