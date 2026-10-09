import { computeLunarEvents } from '@frozik/utils/astronomy/lunarEvents';
import { computeLunarIllumination } from '@frozik/utils/astronomy/lunarIllumination';
import { computeLunarPosition } from '@frozik/utils/astronomy/lunarPosition';
import { computeSolarEvents } from '@frozik/utils/astronomy/solarEvents';
import { computeSolarPosition } from '@frozik/utils/astronomy/solarPosition';
import { MS_PER_MINUTE } from '@frozik/utils/date/constants';
import { isNil } from 'lodash-es';
import type { Temporal } from 'temporal-polyfill';

export interface IGeoPoint {
  readonly latitudeDegrees: number;
  readonly longitudeDegrees: number;
}

interface ICelestialPosition {
  readonly azimuthDegrees: number;
  readonly altitudeDegrees: number;
}

interface IMoonState extends ICelestialPosition {
  readonly illumination: number;
  readonly isWaxing: boolean;
}

export type TSunEventKind = 'sunrise' | 'sunset';

interface ISunEvent {
  readonly kind: TSunEventKind;
  readonly at: Temporal.ZonedDateTime;
  readonly minutesAway: number;
}

export interface ISkyState {
  readonly sun: ICelestialPosition;
  readonly moon: IMoonState;
  readonly sunArc: number | undefined;
  readonly moonArc: number | undefined;
  readonly nextEvent: ISunEvent | undefined;
}

const NOON_HOUR = 12;
const EVENT_DAY_OFFSETS = [-1, 0, 1] as const;

interface IHorizonCrossing {
  readonly rises: boolean;
  readonly atMs: number;
}

export function computeSkyState(now: Temporal.ZonedDateTime, place: IGeoPoint): ISkyState {
  const instant = now.toInstant();
  const { latitudeDegrees, longitudeDegrees } = place;
  const sun = computeSolarPosition(instant, latitudeDegrees, longitudeDegrees);
  const moonPosition = computeLunarPosition(instant, latitudeDegrees, longitudeDegrees);
  const { fraction, isWaxing } = computeLunarIllumination(instant);
  const events = EVENT_DAY_OFFSETS.flatMap(days => sunEventsOfDay(now.add({ days }), place)).sort(
    (left, right) => left.at.epochMilliseconds - right.at.epochMilliseconds
  );

  return {
    sun: { azimuthDegrees: sun.azimuthDegrees, altitudeDegrees: sun.altitudeDegrees },
    moon: {
      azimuthDegrees: moonPosition.azimuthDegrees,
      altitudeDegrees: moonPosition.altitudeDegrees,
      illumination: fraction,
      isWaxing,
    },
    sunArc: arcProgress(
      now.epochMilliseconds,
      events.map(event => ({ rises: event.kind === 'sunrise', atMs: event.at.epochMilliseconds }))
    ),
    moonArc: arcProgress(now.epochMilliseconds, moonCrossings(now, place)),
    nextEvent: nearestEventAfter(now, events),
  };
}

interface IDatedSunEvent {
  readonly kind: TSunEventKind;
  readonly at: Temporal.ZonedDateTime;
}

function sunEventsOfDay(day: Temporal.ZonedDateTime, place: IGeoPoint): IDatedSunEvent[] {
  const noon = day.with({ hour: NOON_HOUR, minute: 0, second: 0, millisecond: 0 });
  const { sunrise, sunset } = computeSolarEvents(
    noon.toInstant(),
    place.latitudeDegrees,
    place.longitudeDegrees
  );
  const toLocal = (instant: Temporal.Instant) => instant.toZonedDateTimeISO(day.timeZoneId);

  return [
    ...(isNil(sunrise) ? [] : [{ kind: 'sunrise' as const, at: toLocal(sunrise) }]),
    ...(isNil(sunset) ? [] : [{ kind: 'sunset' as const, at: toLocal(sunset) }]),
  ];
}

function moonCrossings(now: Temporal.ZonedDateTime, place: IGeoPoint): IHorizonCrossing[] {
  return EVENT_DAY_OFFSETS.flatMap(days => {
    const { moonrise, moonset } = computeLunarEvents(
      now.add({ days }).toInstant(),
      place.latitudeDegrees,
      place.longitudeDegrees
    );
    return [
      ...(isNil(moonrise) ? [] : [{ rises: true, atMs: moonrise.epochMilliseconds }]),
      ...(isNil(moonset) ? [] : [{ rises: false, atMs: moonset.epochMilliseconds }]),
    ];
  }).sort((left, right) => left.atMs - right.atMs);
}

function arcProgress(
  nowMs: number,
  sortedCrossings: readonly IHorizonCrossing[]
): number | undefined {
  const nextIndex = sortedCrossings.findIndex(crossing => crossing.atMs > nowMs);
  if (nextIndex <= 0) {
    return undefined;
  }
  const previous = sortedCrossings[nextIndex - 1];
  const next = sortedCrossings[nextIndex];
  if (!previous.rises || next.rises) {
    return undefined;
  }
  return (nowMs - previous.atMs) / (next.atMs - previous.atMs);
}

function nearestEventAfter(
  now: Temporal.ZonedDateTime,
  events: readonly IDatedSunEvent[]
): ISunEvent | undefined {
  const nowMs = now.epochMilliseconds;
  const nearest = events.find(event => event.at.epochMilliseconds > nowMs);
  if (isNil(nearest)) {
    return undefined;
  }
  return {
    ...nearest,
    minutesAway: Math.round((nearest.at.epochMilliseconds - nowMs) / MS_PER_MINUTE),
  };
}
