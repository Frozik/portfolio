import type { IAxisMapping } from '@frozik/charts/core/viewport/axis-mapping';
import { NANOS_PER_DAY } from '@frozik/utils/date/constants';
import { isNil } from 'lodash-es';

/** Where the elements of an aggregated series stand and how far each one reaches. */
export interface IBarGrid {
  /** The last element at or before the time. */
  floor(time: bigint): bigint;
  next(x: bigint): bigint;
  previous(x: bigint): bigint;
  /** Where the element's interval closes. */
  end(x: bigint): bigint;
}

function floorTo(time: bigint, step: bigint): bigint {
  const remainder = time % step;
  return time - (remainder < 0n ? remainder + step : remainder);
}

/** Elements at every multiple of the step, counted from the epoch. */
export function uniformGrid(step: bigint): IBarGrid {
  return {
    floor: time => floorTo(time, step),
    next: x => x + step,
    previous: x => x - step,
    end: x => x + step,
  };
}

/** The open stretch a time falls in, or the one before it when the time is closed, and where the neighbours begin and end. */
interface ISession {
  readonly start: bigint;
  readonly end: bigint;
  /** Where the session after this one opens; none known when the schedule shows no cut ahead. */
  readonly nextStart: bigint | undefined;
}

/** How far round a time the cuts are looked for: further than any session of a trading schedule runs. */
const SESSION_LOOKOUT = BigInt(NANOS_PER_DAY) * 30n;

/**
 * Elements counted from the opening of each session of a schedule: the first
 * bar of a session starts as it opens, the last one closes as it does, so it
 * may be shorter than the step. Nothing stands in the closed stretches.
 */
export function sessionGrid(step: bigint, mapping: IAxisMapping<bigint>): IBarGrid {
  const sessionOf = (time: bigint): ISession => {
    const virtual = mapping.toVirtual(time);
    const cuts = mapping.cutsIn({
      start: virtual - SESSION_LOOKOUT,
      end: virtual + SESSION_LOOKOUT,
    });
    const before = cuts.findLast(cut => cut.to <= time);
    const after = cuts.find(cut => cut.to > time);
    return {
      start: isNil(before) ? floorTo(time, step) : before.to,
      end: isNil(after) ? time + SESSION_LOOKOUT : after.from,
      nextStart: after?.to,
    };
  };
  const lastBarOf = (session: ISession): bigint =>
    session.start + floorTo(session.end - 1n - session.start, step);

  const floor = (time: bigint): bigint => {
    const session = sessionOf(time);
    return time >= session.end
      ? lastBarOf(session)
      : session.start + floorTo(time - session.start, step);
  };

  return {
    floor,
    next(x): bigint {
      const session = sessionOf(x);
      const following = x + step;
      return following < session.end ? following : (session.nextStart ?? following);
    },
    previous(x): bigint {
      const session = sessionOf(x);
      return x > session.start ? x - step : floor(session.start - 1n);
    },
    end(x): bigint {
      const session = sessionOf(x);
      const closing = x + step;
      return closing < session.end ? closing : session.end;
    },
  };
}
