import { z } from 'zod';

const PORT_MIN = 0;
const PORT_MAX = 65535;
const MAX_EXPRESSION_LENGTH = 1_000;
/** Long enough that the gateway's secret cannot be guessed over the network. */
const MIN_GATEWAY_SECRET_LENGTH = 16;

const GatewaySchema = z
  .object({
    /** The HTTP/3 gateway's own WebSocket listener: never published, the secret required. */
    enabled: z.boolean(),
    host: z.string().min(1),
    port: z.number().int().min(PORT_MIN).max(PORT_MAX),
    secret: z.string(),
  })
  .refine(gateway => !gateway.enabled || gateway.secret.length >= MIN_GATEWAY_SECRET_LENGTH, {
    message: `transport.gateway.secret must be at least ${MIN_GATEWAY_SECRET_LENGTH} characters`,
    path: ['secret'],
  });

export const TransportSectionSchema = z.object({
  /** The WebSocket fallback (public port) and the HTTP/3 gateway's listener both serve this path. */
  enabled: z.boolean(),
  path: z.string().startsWith('/'),
  /** The UDP port browsers reach HTTP/3 on, which the gateway takes; named only in the development pinned certificate. */
  http3_port: z.number().int().min(PORT_MIN).max(PORT_MAX),
  /** Where development writes the self-signed certificate the gateway serves and browsers pin. */
  dev_certificate_dir: z.string().min(1),
  gateway: GatewaySchema,
  max_sessions: z.number().int().min(1),
  max_sessions_per_ip: z.number().int().min(1),
  max_streams_per_session: z.number().int().min(1),
  /** No bytes moving either way on a stream for this long resets it: a stalled reader or writer frees its slot. */
  stream_idle_timeout_ms: z.number().int().min(1),
  expression_max_length: z.number().int().min(1).max(MAX_EXPRESSION_LENGTH),
  expression_max_depth: z.number().int().min(1),
  sample_max_points: z.number().int().min(2),
  sample_chunk_points: z.number().int().min(1),
  echo: z.object({
    max_file_bytes: z.number().int().min(1),
    bytes_per_ip_per_hour: z.number().int().min(1),
    concurrent_per_ip: z.number().int().min(1),
    concurrent_total: z.number().int().min(1),
    rate_bytes_per_second: z.number().int().min(1),
  }),
});
