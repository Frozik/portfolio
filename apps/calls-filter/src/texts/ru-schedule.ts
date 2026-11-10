import { assertNever } from '@frozik/utils/assert/assertNever';

import { plural } from './plural';
import type { ITexts } from './texts';

const count = (value: number, one: string, few: string, many: string) =>
  plural('ru', value, { one: `# ${one}`, few: `# ${few}`, many: `# ${many}`, other: `# ${many}` });

/** The schedule editor's words, laid out like a Google Calendar event. */
export const RU_SCHEDULE: ITexts['schedule'] = {
  title: 'Расписание',
  allDay: 'Весь день',
  from: 'С',
  to: 'До',
  addTime: 'Добавить время',
  removeTime: 'Убрать это время',
  starts: 'Начало',
  repeat: 'Повтор',
  once: 'Не повторяется',
  daily: 'Каждый день',
  weekdays: 'По будням (пн–пт)',
  weekends: 'По выходным (сб–вс)',
  weeklyOn: weekday => `Каждую неделю: ${weekday}`,
  monthlyOn: day => `Каждый месяц, ${day}-го числа`,
  yearlyOn: date => `Каждый год, ${date}`,
  custom: 'Другое…',
  customTitle: 'Свой повтор',
  repeatsEvery: 'Повторять каждые',
  unit: (frequency, value) => {
    switch (frequency) {
      case 'daily':
        return plural('ru', value, { one: 'день', few: 'дня', many: 'дней', other: 'дня' });
      case 'weekly':
        return plural('ru', value, {
          one: 'неделю',
          few: 'недели',
          many: 'недель',
          other: 'недели',
        });
      case 'monthly':
        return plural('ru', value, {
          one: 'месяц',
          few: 'месяца',
          many: 'месяцев',
          other: 'месяца',
        });
      case 'yearly':
        return plural('ru', value, { one: 'год', few: 'года', many: 'лет', other: 'года' });
      default:
        return assertNever(frequency);
    }
  },
  repeatsOn: 'Дни недели',
  ends: 'Окончание',
  never: 'Никогда',
  onDate: date => `Дата: ${date}`,
  after: value => `После ${count(value, 'повторения', 'повторений', 'повторений')}`,
  timeZone: 'Часовой пояс',
  zoneHere: 'Местное время — где бы я ни был',
  zoneHereHint: '21:00 остаётся 21:00 в любом часовом поясе, куда бы вы ни поехали',
  zoneSearch: 'Город или часовой пояс',
  upcoming: 'Ближайшие',
  weekdayLetter: { 1: 'П', 2: 'В', 3: 'С', 4: 'Ч', 5: 'П', 6: 'С', 7: 'В' },
  remove: 'Убрать расписание',
};
