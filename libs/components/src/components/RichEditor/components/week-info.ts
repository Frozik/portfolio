import { EDayOfWeek } from '@frozik/utils/date/constants';

/** ISO day number the locale starts its week on; Monday where the engine has no week data. */
export function defaultStartOfWeek(locale: string): EDayOfWeek {
  const intlLocale = new Intl.Locale(locale);
  const firstDay = intlLocale.getWeekInfo?.().firstDay;

  return firstDay ?? EDayOfWeek.Monday;
}
