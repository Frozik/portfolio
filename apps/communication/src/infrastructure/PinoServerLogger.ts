import type { Logger as PinoLogger } from 'pino';
import { pino } from 'pino';
import type { IServerLogger } from '../application/ports/IServerLogger';

// Field names that must NEVER appear in log output, even if accidentally
// passed in a `fields` object. Pino's `redact` paths apply at the leaf, so we
// list both top-level and nested forms.
const REDACT_PATHS: ReadonlyArray<string> = [
  'idToken',
  'token',
  'access_token',
  'accessToken',
  'turn_secret',
  'shared_secret',
  'static-auth-secret',
  'TURN_SHARED_SECRET',
  'YANDEX_OAUTH_CLIENT_SECRET',
  'yandex_oauth_client_secret',
  'authorization',
  'auth.google_oauth_client_id',
  'auth.yandex_oauth_client_id',
  'auth.yandex_oauth_client_secret',
  '*.idToken',
  '*.token',
  '*.access_token',
  '*.accessToken',
  '*.shared_secret',
  '*.authorization',
];

export class PinoServerLogger implements IServerLogger {
  constructor(private readonly logger: PinoLogger) {}

  child(bindings: Record<string, unknown>): IServerLogger {
    return new PinoServerLogger(this.logger.child(bindings));
  }

  info(msg: string, fields?: Record<string, unknown>): void {
    this.logger.info(fields ?? {}, msg);
  }

  warn(msg: string, fields?: Record<string, unknown>): void {
    this.logger.warn(fields ?? {}, msg);
  }

  error(msg: string, fields?: Record<string, unknown>): void {
    this.logger.error(fields ?? {}, msg);
  }

  debug(msg: string, fields?: Record<string, unknown>): void {
    this.logger.debug(fields ?? {}, msg);
  }
}

// Factory: builds a base pino logger configured with the project's redaction
// rules. The bootstrap layer wraps the result in a `PinoServerLogger` and a
// `PinoAuditLogger` so the two channels share a single transport.
export function createPinoLogger(level: string, pretty: boolean): PinoLogger {
  return pino({
    level,
    transport: pretty ? { target: 'pino-pretty' } : undefined,
    redact: {
      paths: [...REDACT_PATHS],
      censor: '[REDACTED]',
    },
  });
}
