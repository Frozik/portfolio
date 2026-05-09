export interface IAuditLogger {
  audit(
    event: string,
    fields: {
      userIdHash?: string;
      roomId?: string;
      correlationId?: string;
      command?: string;
    }
  ): void;
}
