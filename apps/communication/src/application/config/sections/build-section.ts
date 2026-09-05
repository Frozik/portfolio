import { z } from 'zod';

export const BuildSectionSchema = z.object({
  id: z.string().min(1),
  commit: z.string().min(1),
  version: z.string().min(1),
});
