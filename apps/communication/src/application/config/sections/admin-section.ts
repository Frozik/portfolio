import { z } from 'zod';

const PORT_MIN = 1;
const PORT_MAX = 65_535;

export const AdminSectionSchema = z.object({
  // Allowed to be empty in default.toml; presentation/admin endpoints check
  // for non-empty before accepting any admin request.
  token: z.string(),
  port: z.number().int().min(PORT_MIN).max(PORT_MAX),
});

export type AdminSection = z.infer<typeof AdminSectionSchema>;
