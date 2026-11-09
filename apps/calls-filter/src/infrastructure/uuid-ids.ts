import { randomUUID } from 'expo-crypto';

import type { TNewId } from '../contexts/grouping/domain/ports/id-source';

/** Random UUIDs: books from two phones merge by id, so ids may not collide across them. */
export const UUID_IDS: TNewId = () => randomUUID();
