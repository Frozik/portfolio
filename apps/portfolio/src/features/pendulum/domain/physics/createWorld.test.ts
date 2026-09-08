import { RAILS_HALF_LENGTH } from '../constants';
import { createWorld } from './createWorld';

describe('createWorld', () => {
  it('hangs every bob straight down at rest', () => {
    expect(createWorld({ bobsCount: 3 })).toEqual({
      pivotX: 0,
      pivotVelocity: 0,
      angles: [0, 0, 0],
      angularVelocities: [0, 0, 0],
    });
  });

  it('starts the pivot at the requested rail position, clamped to the rails', () => {
    expect(createWorld({ bobsCount: 1, pivotPosition: 120 }).pivotX).toBe(120);
    expect(createWorld({ bobsCount: 1, pivotPosition: -RAILS_HALF_LENGTH * 2 }).pivotX).toBe(
      -RAILS_HALF_LENGTH
    );
  });

  it('refuses a chain without bobs', () => {
    expect(() => createWorld({ bobsCount: 0 })).toThrow();
  });
});
