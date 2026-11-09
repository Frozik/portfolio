import { z } from 'zod';

import type { IPreferencesStore } from '../contexts/device/domain/ports/preferences-store';
import { DEFAULT_PREFERENCES } from '../contexts/device/domain/preferences';
import { REPEAT_OFF } from '../contexts/policy/domain/repeat-pass';
import { repeatPassCodec } from './codecs/repeat-pass-codec';
import type { SqliteStore } from './sqlite-store';

const PREFERENCES_KEY = 'preferences';

const preferences = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  journalDays: z.number().int().min(1),
  askWhereToAfterCall: z.boolean(),
  repeatPass: repeatPassCodec.default(REPEAT_OFF),
});

export function sqlitePreferencesStore(store: SqliteStore): IPreferencesStore {
  return {
    async load() {
      const text = await store.read(PREFERENCES_KEY);
      if (text === null) {
        return DEFAULT_PREFERENCES;
      }
      const parsed = preferences.safeParse(JSON.parse(text));
      return parsed.success ? parsed.data : DEFAULT_PREFERENCES;
    },
    async save(value) {
      await store.write(PREFERENCES_KEY, JSON.stringify(value));
    },
  };
}
