import type { ICalendarAriaLabels } from '../defs';
import { calendarAriaLabelsEn } from './en';
import { calendarAriaLabelsRu } from './ru';

type Language = 'en' | 'ru';

const CALENDAR_ARIA_LABELS: Record<Language, ICalendarAriaLabels> = {
  en: calendarAriaLabelsEn,
  ru: calendarAriaLabelsRu,
};

export function getCalendarAriaLabels(language: string): ICalendarAriaLabels {
  return CALENDAR_ARIA_LABELS[language as Language] ?? calendarAriaLabelsEn;
}
