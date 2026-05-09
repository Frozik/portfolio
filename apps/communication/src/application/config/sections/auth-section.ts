import { z } from 'zod';

const TOKEN_EXPIRY_WARNING_MAX_SEC = 3_600;
const CLOCK_TOLERANCE_MAX_SEC = 300;
const JWKS_FETCH_MAX_ATTEMPTS_MAX = 10;
const JWKS_FETCH_TIMEOUT_MIN_MS = 100;
const JWKS_FETCH_TIMEOUT_MAX_MS = 60_000;

export const AuthSectionSchema = z.object({
  // Allowed to be empty in default.toml so the merged config still validates
  // when no env override is supplied; the production cross-section
  // refinements in `loadConfig` reject the empty string at startup.
  google_oauth_client_id: z.string(),
  token_expiry_warning_seconds: z.number().int().min(0).max(TOKEN_EXPIRY_WARNING_MAX_SEC),
  clock_tolerance_seconds: z.number().int().min(0).max(CLOCK_TOLERANCE_MAX_SEC),
  jwks: z.object({
    fetch_max_attempts: z.number().int().min(1).max(JWKS_FETCH_MAX_ATTEMPTS_MAX),
    fetch_timeout_ms: z
      .number()
      .int()
      .min(JWKS_FETCH_TIMEOUT_MIN_MS)
      .max(JWKS_FETCH_TIMEOUT_MAX_MS),
  }),
});

export type AuthSection = z.infer<typeof AuthSectionSchema>;
