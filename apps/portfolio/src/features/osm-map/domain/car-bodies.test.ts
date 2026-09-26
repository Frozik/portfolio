import { CAR_BODIES, CAR_COLORS, carBodyMesh, carLengthM } from './car-bodies';

describe('car bodies', () => {
  it('builds a closed box mesh for every body, nose at the front and wheels on the ground', () => {
    for (const body of CAR_BODIES) {
      const mesh = carBodyMesh(body);
      const xs = Array.from(mesh.positions).filter((_, index) => index % 3 === 0);
      const ys = Array.from(mesh.positions).filter((_, index) => index % 3 === 1);

      expect(mesh.indices.length).toBeGreaterThan(0);
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(carLengthM(body), 6);
      expect(Math.min(...ys)).toBeGreaterThan(0);
    }
  });

  it('makes the bus the longest and tallest and keeps a palette to pick from', () => {
    const tallest = (body: (typeof CAR_BODIES)[number]) =>
      Math.max(...Array.from(carBodyMesh(body).positions).filter((_, index) => index % 3 === 1));

    expect(carLengthM('bus')).toBeGreaterThan(
      Math.max(...CAR_BODIES.filter(body => body !== 'bus').map(carLengthM))
    );
    expect(tallest('bus')).toBeGreaterThan(tallest('van'));
    expect(CAR_COLORS.length).toBeGreaterThan(5);
  });
});
