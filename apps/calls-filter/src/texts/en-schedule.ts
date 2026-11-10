import { assertNever } from '@frozik/utils/assert/assertNever';

import { plural } from './plural';
import type { ITexts } from './texts';

const count = (value: number, one: string, other: string) =>
  plural('en', value, { one: `# ${one}`, other: `# ${other}` });

/** The schedule editor's words, laid out like a Google Calendar event. */
export const EN_SCHEDULE: ITexts['schedule'] = {
  title: 'Schedule',
  allDay: 'All day',
  from: 'From',
  to: 'To',
  addTime: 'Add time',
  removeTime: 'Remove this time',
  starts: 'Starts',
  repeat: 'Repeat',
  once: 'Does not repeat',
  daily: 'Every day',
  weekdays: 'Every weekday (Mon–Fri)',
  weekends: 'Every weekend (Sat–Sun)',
  weeklyOn: weekday => `Every week on ${weekday}`,
  monthlyOn: day => `Every month on day ${day}`,
  yearlyOn: date => `Every year on ${date}`,
  custom: 'Custom…',
  customTitle: 'Custom recurrence',
  repeatsEvery: 'Repeats every',
  unit: (frequency, value) => {
    switch (frequency) {
      case 'daily':
        return plural('en', value, { one: 'day', other: 'days' });
      case 'weekly':
        return plural('en', value, { one: 'week', other: 'weeks' });
      case 'monthly':
        return plural('en', value, { one: 'month', other: 'months' });
      case 'yearly':
        return plural('en', value, { one: 'year', other: 'years' });
      default:
        return assertNever(frequency);
    }
  },
  repeatsOn: 'Repeats on',
  ends: 'Ends',
  never: 'Never',
  onDate: date => `On ${date}`,
  after: value => `After ${count(value, 'occurrence', 'occurrences')}`,
  timeZone: 'Time zone',
  zoneHere: 'Local time — wherever I am',
  zoneHereHint: '21:00 stays 21:00 in every time zone you travel to',
  zoneSearch: 'City or time zone',
  upcoming: 'Next',
  weekdayLetter: { 1: 'M', 2: 'T', 3: 'W', 4: 'T', 5: 'F', 6: 'S', 7: 'S' },
  remove: 'Remove schedule',
};
