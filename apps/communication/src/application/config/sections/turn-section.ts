import { z } from 'zod';

const TURN_TTL_MIN_SEC = 60;
const TURN_TTL_MAX_SEC = 86_400;

export const TurnSectionSchema = z.object({
  enabled: z.boolean(),
  shared_secret: z.string(),
  realm: z.string(),
  ttl_seconds: z.number().int().min(TURN_TTL_MIN_SEC).max(TURN_TTL_MAX_SEC),
  urls: z.array(z.string()),
  credential_requests_per_minute_per_socket: z.number().int().min(1),
});

export type TurnSection = z.infer<typeof TurnSectionSchema>;
