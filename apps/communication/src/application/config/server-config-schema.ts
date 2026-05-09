import { z } from 'zod';
import { AdminSectionSchema } from './sections/admin-section';
import { AuthSectionSchema } from './sections/auth-section';
import { BuildSectionSchema } from './sections/build-section';
import { EdgeSectionSchema } from './sections/edge-section';
import { LoggingSectionSchema } from './sections/logging-section';
import { RedisSectionSchema } from './sections/redis-section';
import { RoomSectionSchema } from './sections/room-section';
import { SecuritySectionSchema } from './sections/security-section';
import { ServerSectionSchema } from './sections/server-section';
import { SignalSectionSchema } from './sections/signal-section';
import { TurnSectionSchema } from './sections/turn-section';

// Top-level configuration. Cross-section refinements (env-specific CORS,
// production-mode token policy) are applied at config-load time in Phase 3b
// — kept out of the schema so the type stays a plain composition.
export const ServerConfigSchema = z.object({
  server: ServerSectionSchema,
  auth: AuthSectionSchema,
  room: RoomSectionSchema,
  signal: SignalSectionSchema,
  turn: TurnSectionSchema,
  edge: EdgeSectionSchema,
  security: SecuritySectionSchema,
  admin: AdminSectionSchema,
  logging: LoggingSectionSchema,
  build: BuildSectionSchema,
  redis: RedisSectionSchema,
});

export type IServerConfig = z.infer<typeof ServerConfigSchema>;
