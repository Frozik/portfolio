import { z } from 'zod';

const SIGNAL_PAYLOAD_BYTES_MAX = 1_048_576; // 1 MiB hard cap per spec

export const SignalSectionSchema = z.object({
  max_publish_per_second_per_socket: z.number().int().min(1),
  max_publish_burst: z.number().int().min(1),
  max_payload_bytes: z.number().int().min(1).max(SIGNAL_PAYLOAD_BYTES_MAX),
});
