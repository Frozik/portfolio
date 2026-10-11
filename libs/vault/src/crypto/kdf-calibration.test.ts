import type { Milliseconds } from '@frozik/utils/date/types';

import { createFakeKdf } from '../testing/fake-kdf';
import { calibrateArgon2, chooseArgon2Params } from './kdf-calibration';
import { ARGON2_DEFAULT, ARGON2_FLOOR } from './kdf-port';

describe('Argon2 calibration', () => {
  it.each([
    [130, ARGON2_DEFAULT],
    [1000, ARGON2_DEFAULT],
    [1400, { ...ARGON2_DEFAULT, iterations: 2 }],
    [2900, ARGON2_FLOOR],
    [9000, ARGON2_FLOOR],
  ])(
    'keeps the strongest parameters that open within a second when the default takes %i ms',
    (defaultTakes, expected) => {
      expect(chooseArgon2Params(defaultTakes as Milliseconds)).toEqual(expected);
    }
  );

  it('never raises the cost above the default, whatever the device', () => {
    expect(chooseArgon2Params(1 as Milliseconds)).toEqual(ARGON2_DEFAULT);
  });

  it('measures one run of the default parameters on the given clock', async () => {
    const kdf = createFakeKdf();
    const readings = [0, 1400] as Milliseconds[];

    const params = await calibrateArgon2(kdf, () => readings.shift() ?? (0 as Milliseconds));

    expect(kdf.calls).toBe(1);
    expect(params).toEqual({ ...ARGON2_DEFAULT, iterations: 2 });
  });
});
