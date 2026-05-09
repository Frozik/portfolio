import { z } from 'zod';

export const SecuritySectionSchema = z.object({
  handshake_rate_per_ip_per_minute: z.number().int().min(1),
  failed_handshake_block_threshold: z.number().int().min(1),
  failed_handshake_block_seconds: z.number().int().min(1),
});

export type SecuritySection = z.infer<typeof SecuritySectionSchema>;
