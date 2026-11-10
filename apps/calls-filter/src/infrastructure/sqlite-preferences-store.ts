import { z } from 'zod';

import type { IPreferencesStore } from '../contexts/device/domain/ports/preferences-store';
import type { IDevicePreferences } from '../contexts/device/domain/preferences';
import { DEFAULT_PREFERENCES } from '../contexts/device/domain/preferences';
import type { IDiagnosticsLog } from '../contexts/diagnostics/domain/ports/diagnostics-log';
import { REPEAT_OFF } from '../contexts/policy/domain/repeat-pass';
import { repeatPassCodec } from './codecs/repeat-pass-codec';
import type { SqliteStore } from './sqlite-store';
import type { IStoredDocument } from './stored-document';
import { loadDocument, saveDocument } from './stored-document';

const preferences = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  journalDays: z.number().int().min(1),
  askWhereToAfterCall: z.boolean(),
  repeatPass: repeatPassCodec.default(REPEAT_OFF),
});

/** Version 1 put the preferences under a version; version 0 was the bare object. */
export const PREFERENCES_DOCUMENT: IStoredDocument<IDevicePreferences> = {
  key: 'preferences',
  history: { version: 1, migrations: { 0: data => data } },
  parse: data => {
    const parsed = preferences.safeParse(data);
    return parsed.success ? parsed.data : null;
  },
};

export function sqlitePreferencesStore(
  store: SqliteStore,
  diagnostics: IDiagnosticsLog
): IPreferencesStore {
  return {
    load: async () =>
      (await loadDocument(store, PREFERENCES_DOCUMENT, diagnostics)) ?? DEFAULT_PREFERENCES,
    save: value => saveDocument(store, PREFERENCES_DOCUMENT, value),
  };
}
