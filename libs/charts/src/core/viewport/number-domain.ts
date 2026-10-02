import type { IAxisDomain } from './axis-domain';

export const numberDomain: IAxisDomain<number> = {
  compare: (first, second) => first - second,
  diff: (minuend, subtrahend) => minuend - subtrahend,
  add: (position, delta) => position + delta,
};
