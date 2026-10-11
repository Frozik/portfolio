import { isNil } from 'lodash-es';
import { z } from 'zod';

import type { TCardDraft } from '../model/draft';
import { readCardState } from './document-codec';
import { CARD_STATE_SCHEMA } from './document-schema';

const DRAFT_SCHEMA = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('new'), card: CARD_STATE_SCHEMA }),
  z.object({ kind: z.literal('edit'), base: CARD_STATE_SCHEMA, card: CARD_STATE_SCHEMA }),
]);

/** A draft read back from the device store; anything else is no draft at all. */
export function decodeDraft(value: unknown): TCardDraft | null {
  const parsed = DRAFT_SCHEMA.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  const card = readCardState(parsed.data.card);
  if (isNil(card)) {
    return null;
  }
  if (parsed.data.kind === 'new') {
    return { kind: 'new', card };
  }
  const base = readCardState(parsed.data.base);
  return isNil(base) ? null : { kind: 'edit', base, card };
}
