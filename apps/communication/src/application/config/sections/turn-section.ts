import { z } from 'zod';

const TURN_TTL_MIN_SEC = 60;
const TURN_TTL_MAX_SEC = 86_400;
/**
 * Default relay window for anonymous (optional-auth) sessions. Anonymous
 * identities are free to mint, so their TURN credentials expire sooner than
 * authenticated ones; the client refreshes credentials on demand.
 */
const TURN_ANONYMOUS_TTL_DEFAULT_SEC = 600;

export const TurnSectionSchema = z.object({
  enabled: z.boolean(),
  shared_secret: z.string(),
  realm: z.string(),
  ttl_seconds: z.number().int().min(TURN_TTL_MIN_SEC).max(TURN_TTL_MAX_SEC),
  anonymous_ttl_seconds: z
    .number()
    .int()
    .min(TURN_TTL_MIN_SEC)
    .max(TURN_TTL_MAX_SEC)
    .default(TURN_ANONYMOUS_TTL_DEFAULT_SEC),
  urls: z.array(z.string()),
  credential_requests_per_minute_per_socket: z.number().int().min(1),
});

export type TurnSection = z.infer<typeof TurnSectionSchema>;
