import { CALL_SCREENING } from '../../modules/call-screening/src/CallScreeningModule';
import type { TListTimeZones } from '../contexts/policy/domain/ports/time-zones';

export const NATIVE_TIME_ZONES: TListTimeZones = () =>
  [...CALL_SCREENING.timeZones()].sort(
    (left, right) => left.offsetMinutes - right.offsetMinutes || left.city.localeCompare(right.city)
  );
