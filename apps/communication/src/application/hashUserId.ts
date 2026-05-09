import { createHash } from 'node:crypto';
import type { UserId } from '../domain/types';

// Length of the hex digest exposed in audit logs and TURN credentials.
const USER_ID_HASH_HEX_LENGTH = 16;

export function hashUserId(userId: UserId): string {
  return createHash('sha256').update(userId).digest('hex').slice(0, USER_ID_HASH_HEX_LENGTH);
}
