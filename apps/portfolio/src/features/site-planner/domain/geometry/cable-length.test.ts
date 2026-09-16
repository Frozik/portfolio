import { describe, expect, it } from 'vitest';

import { cableRunLengthMeters, runHeightMeters } from './cable-length';

describe('cableRunLengthMeters', () => {
  it('adds the drops from a ceiling run to the panel and to a socket', () => {
    const length = cableRunLengthMeters({
      planPoints: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
      level: 'ceiling',
      storeyHeightMeters: 2.7,
      fromHeightMeters: 1.5,
      toHeightMeters: 0.3,
    });

    // 4 m along, 2.55 − 1.5 down to the panel, 2.55 − 0.3 down to the socket.
    expect(length).toBeCloseTo(4 + 1.05 + 2.25);
  });

  it('costs a ceiling light nothing beyond the run itself', () => {
    const storeyHeightMeters = 2.7;
    const length = cableRunLengthMeters({
      planPoints: [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
      ],
      level: 'ceiling',
      storeyHeightMeters,
      fromHeightMeters: runHeightMeters('ceiling', storeyHeightMeters),
      toHeightMeters: storeyHeightMeters - 0.15,
    });

    expect(length).toBeCloseTo(3);
  });

  it('measures a floor run up to the devices instead of down', () => {
    const length = cableRunLengthMeters({
      planPoints: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
      level: 'floor',
      storeyHeightMeters: 2.7,
      fromHeightMeters: 1.5,
      toHeightMeters: 0.3,
    });

    expect(length).toBeCloseTo(2 + 1.45 + 0.25);
  });
});
