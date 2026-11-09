import { Temporal } from 'temporal-polyfill';

import type { IRecurrenceExpander } from '../domain/recurrence-expander';
import { ScheduleEditor } from './ScheduleEditor';

const NO_OCCURRENCES: IRecurrenceExpander = { occurrences: () => [] };
const MONDAY = Temporal.PlainDate.from('2026-11-09');
const editorOf = () => new ScheduleEditor(null, MONDAY, 'Europe/Amsterdam', NO_OCCURRENCES);

describe('editing a schedule like a Google Calendar event', () => {
  it('starts on weekdays 9–18 on the clock of the zone the phone is in', () => {
    const editor = editorOf();
    expect(editor.zone).toEqual({ kind: 'fixed', zone: 'Europe/Amsterdam' });
    expect(editor.preset).toBe('weekdays');
  });

  it('says «every week on Wednesday» once the start moves to a Wednesday', () => {
    const editor = editorOf();
    editor.setPreset('weekly');
    editor.setStart(MONDAY.add({ days: 2 }));
    expect(editor.repeat?.weekdays).toEqual([3]);
    expect(editor.preset).toBe('weekly');
  });

  it('takes a custom repeat no preset can say', () => {
    const editor = editorOf();
    editor.setRepeat({
      frequency: 'weekly',
      interval: 2,
      weekdays: [2, 4],
      monthly: null,
      end: { kind: 'count', count: 5 },
    });
    expect(editor.preset).toBe('custom');
  });

  it('never adds the same time range twice', () => {
    const editor = editorOf();
    editor.addTime();
    editor.addTime();
    const ranges = editor.times.map(time =>
      time.kind === 'range' ? `${time.from.toString()}-${time.to.toString()}` : 'all-day'
    );
    expect(new Set(ranges).size).toBe(ranges.length);
  });
});
