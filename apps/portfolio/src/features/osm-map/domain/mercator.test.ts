import { lonLatToWorld, MAX_LATITUDE, worldToLonLat } from './mercator';

describe('mercator', () => {
  it('maps the null island to the centre of the unit square', () => {
    expect(lonLatToWorld({ lon: 0, lat: 0 })).toEqual({ x: 0.5, y: 0.5 });
  });

  it('round-trips a city through world coordinates', () => {
    const moscow = { lon: 37.6208, lat: 55.7539 };

    const back = worldToLonLat(lonLatToWorld(moscow));

    expect(back.lon).toBeCloseTo(moscow.lon, 9);
    expect(back.lat).toBeCloseTo(moscow.lat, 9);
  });

  it('pins the poles to the square edge instead of running off to infinity', () => {
    expect(lonLatToWorld({ lon: 0, lat: 90 }).y).toBeCloseTo(0, 6);
    expect(lonLatToWorld({ lon: 0, lat: -90 }).y).toBeCloseTo(1, 6);
    expect(worldToLonLat({ x: 0.5, y: 0 }).lat).toBeCloseTo(MAX_LATITUDE, 6);
  });
});
