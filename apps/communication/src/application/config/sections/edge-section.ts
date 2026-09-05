import { z } from 'zod';

export const EdgeSectionSchema = z.object({
  haproxy_enabled: z.boolean(),
});
