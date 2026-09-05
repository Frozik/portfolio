import { z } from 'zod';

export const LoggingSectionSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']),
  pretty: z.boolean(),
});
