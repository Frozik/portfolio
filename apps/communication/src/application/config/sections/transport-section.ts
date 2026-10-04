import { z } from 'zod';

const PORT_MIN = 0;
const PORT_MAX = 65535;
const MAX_EXPRESSION_LENGTH = 1_000;

export const TransportSectionSchema = z.object({
  /** HTTP/3 (UDP) and the WebSocket fallback (TCP, on the public port) both live on this path. */
  enabled: z.boolean(),
  path: z.string().startsWith('/'),
  http3_host: z.string().min(1),
  http3_port: z.number().int().min(PORT_MIN).max(PORT_MAX),
  max_sessions: z.number().int().min(1),
  max_sessions_per_ip: z.number().int().min(1),
  max_streams_per_session: z.number().int().min(1),
  /** No bytes moving either way on a stream for this long resets it: a stalled reader or writer frees its slot. */
  stream_idle_timeout_ms: z.number().int().min(1),
  stream_window_bytes: z.number().int().min(1),
  session_window_bytes: z.number().int().min(1),
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
