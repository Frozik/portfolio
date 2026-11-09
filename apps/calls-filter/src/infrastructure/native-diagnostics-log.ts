import { Temporal } from 'temporal-polyfill';

import { CALL_SCREENING } from '../../modules/call-screening/src/CallScreeningModule';
import type { IDiagnosticsLog } from '../contexts/diagnostics/domain/ports/diagnostics-log';

/** One log for the app and the service: the module keeps it, redacting every entry on the way in. */
export const NATIVE_DIAGNOSTICS_LOG: IDiagnosticsLog = {
  log: (level, category, event, fields = {}) => CALL_SCREENING.log(level, category, event, fields),
  latest: limit =>
    CALL_SCREENING.diagnostics(limit).map(entry => ({
      at: Temporal.Instant.fromEpochMilliseconds(entry.epochMs),
      level: entry.level,
      category: entry.category,
      event: entry.event,
      fields: entry.fields,
    })),
};
