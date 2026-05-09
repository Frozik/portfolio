import { describe, expect, it } from 'vitest';
import type { UserId } from '../domain/types';
import { hashUserId } from './hashUserId';

describe('hashUserId', () => {
  it('returns the first 16 hex characters of sha256 of the userId', () => {
    const userId = '11111111-2222-4333-8444-555555555555' as UserId;
    expect(hashUserId(userId)).toBe('cf4c4732fd3b8f8a');
  });

  it('produces a stable 16-char hex output', () => {
    const userId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' as UserId;
    const out = hashUserId(userId);
    expect(out).toHaveLength(16);
    expect(out).toMatch(/^[0-9a-f]+$/);
  });
});
