import { MS_PER_SECOND, SECONDS_PER_MINUTE } from '@frozik/utils/date/constants';
import { isNil } from 'lodash-es';
import { memo, useMemo } from 'react';
import { Temporal } from 'temporal-polyfill';

import { computeSkyState } from '../../../../domain/sky-state';
import type { ISkyState } from '../../../../domain/sky-state';
import { MY_LOCATION, MY_TIMEZONE } from '../../../availability-constants';
import { useSecondTick } from '../../../hooks/useSecondTick';
import { welcomeT } from '../../../translations';
import { SkyDial } from './SkyDial';

export const SkyDialPanel = memo(() => {
  const epochSecond = useSecondTick();
  const epochMinute = Math.floor(epochSecond / SECONDS_PER_MINUTE);
  const now = useMemo(() => zonedAt(epochSecond), [epochSecond]);
  const sky = useMemo(
    () => computeSkyState(zonedAt(epochMinute * SECONDS_PER_MINUTE), MY_LOCATION),
    [epochMinute]
  );
  const nextEventTime = sky.nextEvent?.at.toPlainTime().toString({ smallestUnit: 'minute' });

  return (
    <div className="size-60 rounded-full shadow-2xl ring-1 ring-landing-border">
      <SkyDial
        sky={sky}
        time={{ hour: now.hour, minute: now.minute, second: now.second }}
        nextEventTime={nextEventTime}
        label={describeDial(now, sky, nextEventTime)}
      />
    </div>
  );
});

function zonedAt(epochSecond: number): Temporal.ZonedDateTime {
  return Temporal.Instant.fromEpochMilliseconds(epochSecond * MS_PER_SECOND).toZonedDateTimeISO(
    MY_TIMEZONE
  );
}

function describeDial(
  now: Temporal.ZonedDateTime,
  sky: ISkyState,
  nextEventTime: string | undefined
): string {
  const t = welcomeT.hero;
  const clock = now.toPlainTime().toString({ smallestUnit: 'minute' });
  const parts = [t.sky.label, `${t.myTime} ${clock} ${t.utc}`];
  if (!isNil(sky.nextEvent) && !isNil(nextEventTime)) {
    parts.push(`${t.sky[sky.nextEvent.kind]} ${nextEventTime}`);
  }
  return parts.join('. ');
}
