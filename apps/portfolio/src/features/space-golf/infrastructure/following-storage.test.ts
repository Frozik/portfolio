import { afterEach, describe, expect, it } from 'vitest';

import { createFollowingStorage } from './following-storage';

describe('the remembered way of following', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('centres the ball at rest on a first visit', () => {
    expect(createFollowingStorage().read()).toBe('rest');
  });

  it('reads back what was chosen, in a storage opened anew', () => {
    createFollowingStorage().write('always');

    expect(createFollowingStorage().read()).toBe('always');
  });

  it('falls back to centring at rest over an entry it never wrote', () => {
    localStorage.setItem('space-golf:following', 'sideways');

    expect(createFollowingStorage().read()).toBe('rest');
  });
});
