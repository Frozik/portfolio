import type { Logger as PinoLogger } from 'pino';
import type { IAuditLogger } from '../application/ports/IAuditLogger';

export class PinoAuditLogger implements IAuditLogger {
  constructor(private readonly logger: PinoLogger) {}

  audit(
    event: string,
    fields: {
      userIdHash?: string;
      roomId?: string;
      correlationId?: string;
      command?: string;
    }
  ): void {
    this.logger.info({ ...fields, audit_event: event }, 'audit');
  }
}
