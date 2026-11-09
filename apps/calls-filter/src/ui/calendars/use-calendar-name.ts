import type { TCalendarSource } from '../../contexts/calendars/domain/calendar-source';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';

/** How a rule's calendar is named in a sentence: its own name, or «holidays where I am». */
export function useCalendarName(): (source: TCalendarSource) => string {
  const app = useApp();
  const texts = useTexts();
  return source => {
    const name = app.calendars.sourceName(source);
    return name === null ? texts.calendars.holidaysHereInSentence : `«${name}»`;
  };
}
