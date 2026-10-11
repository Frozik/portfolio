import { createSeededRandom } from '../testing/seeded-random';
import { newCardId, randomUuid } from './ids';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('ids', () => {
  it('are version-4 UUIDs drawn from the injected randomness', () => {
    const ids = Array.from({ length: 50 }, (_, seed) => randomUuid(createSeededRandom(seed)));

    expect(ids.every(id => UUID_V4.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('repeat for the same seed, so fixtures are reproducible', () => {
    expect(newCardId(createSeededRandom(5))).toBe(newCardId(createSeededRandom(5)));
  });
});
