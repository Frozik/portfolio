import { Temporal } from 'temporal-polyfill';
import { z } from 'zod';

/** «A repeat rings» as stored: the group's in the book, the filter-wide one in the preferences. */
export const repeatPassCodec = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('off') }),
  z.object({ kind: z.literal('always') }),
  z.object({
    kind: z.literal('until'),
    until: z.string().transform(text => Temporal.Instant.from(text)),
  }),
]);
