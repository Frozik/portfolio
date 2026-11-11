import { assertNever } from '@frozik/utils/assert/assertNever';

import type { TLifecycleEvent } from '../../session/domain/lifecycle-events';
import type {
  IDiagnosticsNote,
  TDiagnosticsCategory,
  TDiagnosticsLevel,
} from './diagnostics-entry';

function note(
  level: TDiagnosticsLevel,
  category: TDiagnosticsCategory,
  event: string,
  fields: Readonly<Record<string, string>> = {}
): IDiagnosticsNote {
  return { level, category, event, fields };
}

/** The vault's lifecycle as the log keeps it: what happened and why, never the name, password or code. */
export function lifecycleDiagnostics(event: TLifecycleEvent): IDiagnosticsNote | null {
  switch (event.kind) {
    case 'vault-chosen':
      return note('info', 'app', 'vault-chosen', {
        kept: String(event.kept),
        ...(event.reason === null ? {} : { reason: event.reason }),
      });
    case 'create-requested':
      return note('info', 'app', 'create-requested');
    case 'created':
      return event.result.ok
        ? note('info', 'app', 'created')
        : note('error', 'app', 'create-failed', { failure: event.result.error });
    case 'unlock-requested':
      return note('info', 'unlock', 'requested', { with: event.credential.kind });
    case 'device-unlock-requested':
      return note('info', 'unlock', 'requested', { with: 'biometric' });
    case 'quick-unlock-requested':
      return note('info', 'unlock', 'requested', { with: 'quick-code' });
    case 'opened':
      if (event.result.ok) {
        return note('info', 'unlock', 'opened', { access: event.result.value });
      }
      return note(event.result.error === 'wrong-password' ? 'warn' : 'error', 'unlock', 'failed', {
        failure: event.result.error,
      });
    case 'unlock-cancelled':
      return note('info', 'unlock', 'cancelled');
    case 'lock-requested':
      return note('info', 'lock', 'requested', { reason: event.reason });
    case 'quick-locked':
      return event.held
        ? note('info', 'lock', 'quick-held')
        : note('warn', 'lock', 'quick-not-held');
    case 'quick-expired':
      return note('info', 'lock', 'quick-expired');
    case 'quick-unlock-changed':
      return note('info', 'unlock', 'quick-unlock', { ready: String(event.ready) });
    case 'sync-stopped':
      return note('error', 'sync', 'stopped', { stop: event.stop.kind });
    case 'forgotten':
      return note('info', 'app', 'forgotten');
    case 'draft-flushed':
      return null;
    default:
      return assertNever(event);
  }
}
