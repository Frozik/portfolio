import type { Milliseconds, Seconds } from '../date/types';
import type { Brand, Unbrand } from './base';

type RoomId = Brand<string, 'RoomId'>;
type Tags = Brand<readonly string[], 'Tags'>;

describe('Brand', () => {
  it('stays assignable to its base but never takes a bare value or another brand', () => {
    expectTypeOf<Milliseconds>().toExtend<number>();
    expectTypeOf<number>().not.toExtend<Milliseconds>();
    expectTypeOf<Seconds>().not.toExtend<Milliseconds>();
  });

  it('unbrands back to the base type, member by member in a union', () => {
    expectTypeOf<Unbrand<RoomId>>().toEqualTypeOf<string>();
    expectTypeOf<Unbrand<Tags>>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<Unbrand<Milliseconds | undefined>>().toEqualTypeOf<number | undefined>();
    expectTypeOf<Unbrand<boolean>>().toEqualTypeOf<boolean>();
  });
});
