import { Temporal } from 'temporal-polyfill';
import { z } from 'zod';

import type { TCalendarSource, TIcsId } from '../contexts/calendars/domain/calendar-source';
import type { ICalendarStore } from '../contexts/calendars/domain/ports/calendar-store';
import type { TCountryCode } from '../contexts/phone/domain/dialing-region';
import type { SqliteStore } from './sqlite-store';

const CALENDARS_KEY = 'calendars';

const instant = z
  .string()
  .nullable()
  .transform(text => (text === null ? null : Temporal.Instant.from(text)));

const source = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('device'),
    accountType: z.string(),
    accountName: z.string(),
    calendarName: z.string(),
  }),
  z.object({ kind: z.literal('ics'), id: z.string() }),
  z.object({ kind: z.literal('holidays-here') }),
]);

const settings = z.object({
  subscriptions: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      url: z.string(),
      holidaysOf: z.string().nullable(),
      body: z.string().nullable(),
      etag: z.string().nullable(),
      refreshedAt: instant,
      failedAt: instant,
    })
  ),
  holidays: z.array(z.tuple([z.string(), source])),
});

function sourceOf(stored: z.infer<typeof source>): TCalendarSource {
  return stored.kind === 'ics' ? { kind: 'ics', id: stored.id as TIcsId } : stored;
}

export function sqliteCalendarStore(store: SqliteStore): ICalendarStore {
  return {
    async load() {
      const text = await store.read(CALENDARS_KEY);
      const parsed = text === null ? null : settings.safeParse(JSON.parse(text));
      if (parsed === null || !parsed.success) {
        return { subscriptions: [], holidays: new Map() };
      }
      return {
        subscriptions: parsed.data.subscriptions.map(subscription => ({
          ...subscription,
          id: subscription.id as TIcsId,
          holidaysOf: subscription.holidaysOf as TCountryCode | null,
        })),
        holidays: new Map(
          parsed.data.holidays.map(([country, mapped]) => [
            country as TCountryCode,
            sourceOf(mapped),
          ])
        ),
      };
    },
    async save(value) {
      await store.write(
        CALENDARS_KEY,
        JSON.stringify({
          subscriptions: value.subscriptions.map(subscription => ({
            ...subscription,
            refreshedAt: subscription.refreshedAt?.toString() ?? null,
            failedAt: subscription.failedAt?.toString() ?? null,
          })),
          holidays: [...value.holidays],
        })
      );
    },
  };
}
