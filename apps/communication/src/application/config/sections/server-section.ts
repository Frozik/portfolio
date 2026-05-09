import { z } from 'zod';

const PORT_MIN = 1;
const PORT_MAX = 65535;
const SHUTDOWN_GRACE_MIN_MS = 1_000;
const SHUTDOWN_GRACE_MAX_MS = 120_000;

export const ServerSectionSchema = z.object({
  port: z.number().int().min(PORT_MIN).max(PORT_MAX),
  host: z.string().min(1),
  cors_allowed_origins: z.array(z.string()),
  tls: z.object({
    enabled: z.boolean(),
    cert_path: z.string(),
    key_path: z.string(),
  }),
  shutdown_grace_ms: z.number().int().min(SHUTDOWN_GRACE_MIN_MS).max(SHUTDOWN_GRACE_MAX_MS),
});

export type ServerSection = z.infer<typeof ServerSectionSchema>;
