import { splitAtPool } from './number-pool-split';

describe('a number cut after the digits of its pool', () => {
  it('keeps the plus and the separators with the part they belong to', () => {
    expect(splitAtPool('+7 986 510-71-91', '7986')).toEqual(['+7 986', ' 510-71-91']);
  });

  it('cuts inside a group of digits when the pool ends there', () => {
    expect(splitAtPool('+7 961 539-60-21', '79615')).toEqual(['+7 961 5', '39-60-21']);
  });

  it('leaves the number whole when it has fewer digits than the pool', () => {
    expect(splitAtPool('112', '7986')).toEqual(['', '112']);
  });
});
