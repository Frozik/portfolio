import { DateTimePicker } from '@frozik/components/components/RichEditor/DateTimePicker';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { useToday } from '@frozik/components/hooks/useToday';
import { parseFuzzyDate } from '@frozik/utils/date/fuzzy/parseFuzzyDate';
import { isNil } from 'lodash-es';
import { Pause, Play, Sunrise, Sunset } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useMemo } from 'react';
import { Temporal } from 'temporal-polyfill';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { Slider } from '../../../../shared/ui/Slider';
import { Tooltip } from '../../../../shared/ui/Tooltip';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { formatClockTime } from '../../domain/sun/sun-study';
import { sitePlannerT } from '../translations';

const ICON_SIZE_PX = 14;
/** The slider steps by the minute; the sun does not jump between two of them. */
const TIME_STEP_MINUTES = 1;
/** The picker speaks in whole moments; a study reads only the day out of one. */
const MIDNIGHT = new Temporal.PlainTime(0);

/**
 * The sun study: the date and the time of day the 3D view is lit at, floating
 * over the bottom of the canvas so the scene it changes stays in sight.
 */
export const SunStudyPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const { sunDate, sunDayWindow, sunTimeMinutes } = store;
  const { timeZoneId } = store.settings.location;
  const today = useToday(timeZoneId);

  const pickedDate = useMemo(
    () => sunDate.toZonedDateTime({ timeZone: timeZoneId, plainTime: MIDNIGHT }),
    [sunDate, timeZoneId]
  );

  /**
   * `nearest` rather than the default future-only reading: a study is as often
   * about the winter that has passed as about the summer to come.
   */
  const parseDateInput = useFunction((input: string) =>
    parseFuzzyDate(input, { now: Temporal.Now.zonedDateTimeISO(timeZoneId), nearest: true })
  );

  const handleDateChange = useFunction((picked: Temporal.ZonedDateTime | undefined) => {
    if (!isNil(picked)) {
      store.setSunDate(picked.toPlainDate());
    }
  });

  if (!store.isSunStudyOpen) {
    return undefined;
  }

  const animationLabel = store.isSunAnimating
    ? sitePlannerT.sun.pauseDay
    : sitePlannerT.sun.playDay;

  return (
    <section
      aria-label={sitePlannerT.sun.title}
      className="absolute right-14 bottom-3 left-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/70 px-3 py-2 backdrop-blur-sm sm:right-auto sm:left-1/2 sm:w-[34rem] sm:-translate-x-1/2"
    >
      <fieldset className="w-36 shrink-0">
        <legend className="sr-only">{sitePlannerT.sun.date}</legend>
        <DateTimePicker
          value={pickedDate}
          onValueChange={handleDateChange}
          timeZone={timeZoneId}
          onParseInput={parseDateInput}
          showTime={false}
          today={today}
          placeholder={sitePlannerT.sun.date}
          language={getCurrentLanguage()}
        />
      </fieldset>

      {/* The icons mark the ends of the sweep — the slider runs from the day's
          own sunrise to its own sunset, not from midnight to midnight. */}
      <fieldset className="flex min-w-40 flex-1 items-center gap-2">
        <legend className="sr-only">{sitePlannerT.sun.time}</legend>
        <Sunrise size={ICON_SIZE_PX} className="shrink-0 text-text-muted" aria-hidden />
        <Slider
          min={sunDayWindow.sunriseMinutes}
          max={sunDayWindow.sunsetMinutes}
          step={TIME_STEP_MINUTES}
          value={sunTimeMinutes}
          onChange={store.setSunTimeMinutes}
          showTooltip
          formatTooltip={formatClockTime}
        />
        <Sunset size={ICON_SIZE_PX} className="shrink-0 text-text-muted" aria-hidden />
      </fieldset>

      <output className="w-12 shrink-0 text-center font-mono text-xs text-text">
        {formatClockTime(sunTimeMinutes)}
      </output>

      <Tooltip title={animationLabel} placement="top">
        <button
          type="button"
          aria-label={animationLabel}
          aria-pressed={store.isSunAnimating}
          onClick={store.toggleSunAnimation}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors duration-150 hover:bg-white/10 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {store.isSunAnimating ? (
            <Pause size={ICON_SIZE_PX} aria-hidden />
          ) : (
            <Play size={ICON_SIZE_PX} aria-hidden />
          )}
        </button>
      </Tooltip>
    </section>
  );
});
