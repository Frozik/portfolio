import type { ICalendarAriaLabels } from '../defs';
import { calendarAriaLabelsEn } from './en';
import { calendarAriaLabelsRu } from './ru';

const CALENDAR_ARIA_LABELS: Readonly<Record<string, ICalendarAriaLabels>> = {
  en: calendarAriaLabelsEn,
  ru: calendarAriaLabelsRu,
};

/** UI labels for the language of a BCP-47 tag; English for languages without a table. */
export function getCalendarAriaLabels(locale: string): ICalendarAriaLabels {
  const [language = ''] = locale.toLowerCase().split('-');
  return CALENDAR_ARIA_LABELS[language] ?? calendarAriaLabelsEn;
}
