import { DEFAULT_VIEW } from './map-view';
import { formatViewHash, parseViewHash } from './view-hash';

describe('view hash', () => {
  it('round-trips a view through the hash at its printed precision', () => {
    const view = { lat: 55.75391, lon: 37.62081, zoom: 14.25, bearingDeg: -30.5, pitchDeg: 50 };

    expect(parseViewHash(`#${formatViewHash(view)}`)).toEqual(view);
  });

  it('rejects hashes that are malformed or out of range', () => {
    expect(parseViewHash('')).toBeUndefined();
    expect(parseViewHash('#14/55.75')).toBeUndefined();
    expect(parseViewHash('#14/55.75/37.62/0/abc')).toBeUndefined();
    expect(parseViewHash('#14/95/37.62/0/50')).toBeUndefined();
    expect(parseViewHash('#14/55.75/37.62/0/80')).toBeUndefined();
    expect(parseViewHash(`#${formatViewHash(DEFAULT_VIEW)}`)).toBeDefined();
  });
});
