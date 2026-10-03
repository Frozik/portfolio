import { describe, expect, it } from 'vitest';

import { columnsOf } from '../../core/series/columns';
import { cutsMapping } from '../../core/viewport/axis-mapping';
import { numberDomain } from '../../core/viewport/number-domain';
import { timeDomain } from '../../core/viewport/time-domain';
import { cutColumns } from './cut-columns';

/** 40…60 is taken out of a numeric axis. */
const mapping = cutsMapping(numberDomain, [{ from: 40, to: 60 }]);

function points(...xs: readonly number[]) {
  return columnsOf({ shape: 'point', points: xs.map(x => ({ x, value: x })) });
}

describe('cutting a batch of columns', () => {
  it('moves positions into the virtual coordinate and drops points inside the cut', () => {
    const cut = cutColumns(
      { domain: numberDomain, mapping, step: undefined, aggregateTime: 'start' },
      points(30, 40, 50, 60, 70)
    );

    expect([...cut.x]).toEqual([30, 40, 40, 50]);
    expect(cut.shape === 'point' ? [...cut.value] : []).toEqual([30, 40, 60, 70]);
  });

  it('drops an aggregate only when nothing of its interval is left', () => {
    const cutting = { domain: numberDomain, mapping, step: 10, aggregateTime: 'start' as const };

    expect([...cutColumns(cutting, points(30, 40, 45, 55, 60)).x]).toEqual([30, 40, 40]);
  });

  it('measures an interval backwards for an aggregate stamped by its end', () => {
    const cutting = { domain: numberDomain, mapping, step: 10, aggregateTime: 'end' as const };

    expect([...cutColumns(cutting, points(40, 50, 60, 65)).x]).toEqual([40, 45]);
  });

  it('keeps every column of a candle together', () => {
    const cut = cutColumns(
      { domain: numberDomain, mapping, step: undefined, aggregateTime: 'start' },
      columnsOf({
        shape: 'candle',
        candles: [30, 50, 70].map(x => ({ x, open: x, min: x - 1, max: x + 1, close: x + 0.5 })),
      })
    );

    expect(cut.shape).toBe('candle');
    expect([...cut.x]).toEqual([30, 50]);
    expect(cut.shape === 'candle' ? [...cut.close] : []).toEqual([30.5, 70.5]);
  });

  it('keeps time exact in a bigint column', () => {
    const domain = timeDomain();
    const cut = cutColumns(
      {
        domain,
        mapping: cutsMapping(domain, [{ from: 10n, to: 20n }]),
        step: undefined,
        aggregateTime: 'start',
      },
      columnsOf({ shape: 'point', points: [{ x: 25n, value: 1 }] })
    );

    expect(cut.x).toBeInstanceOf(BigInt64Array);
    expect([...cut.x]).toEqual([15n]);
  });
});
