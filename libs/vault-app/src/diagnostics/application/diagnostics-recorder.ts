import { Temporal } from 'temporal-polyfill';

import type { ISessionClock } from '../../session/domain/ports/session-clock';
import type { IDiagnosticsNote } from '../domain/diagnostics-entry';
import type { IDiagnosticsJournal } from '../domain/ports/diagnostics-journal';

/** A note goes into the device's log stamped with the time; where the platform keeps none, nowhere. */
export function noteDiagnostics(
  device: {
    readonly diagnostics: IDiagnosticsJournal | null;
    readonly clock: Pick<ISessionClock, 'now'>;
  },
  note: IDiagnosticsNote | null
): void {
  if (note !== null) {
    device.diagnostics?.append({
      ...note,
      at: Temporal.Instant.fromEpochMilliseconds(device.clock.now()),
    });
  }
}
