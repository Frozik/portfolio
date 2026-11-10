import { action, computed, makeObservable, observableRef } from 'mobx';
import { Temporal } from 'temporal-polyfill';

import { floatingMinute } from '../domain/floating-time';
import type { IPolicy } from '../domain/policy';
import { withConditions } from '../domain/policy';
import type { IRecurrenceExpander } from '../domain/recurrence-expander';
import type {
  IRecurrence,
  ISchedule,
  TScheduleTime,
  TScheduleZone,
  TWeekday,
} from '../domain/schedule';
import { scheduleWindows } from '../domain/schedule-windows';
import type { IWindow } from '../domain/window-set';
import type { TRepeatPreset } from './repeat-presets';
import { presetOf, presetRecurrence } from './repeat-presets';

const UPCOMING = 3;
const LOOKAHEAD_DAYS = 40;
const WORK_DAY: TScheduleTime = {
  kind: 'range',
  from: Temporal.PlainTime.from('09:00'),
  to: Temporal.PlainTime.from('18:00'),
};
const AFTERNOON: Extract<TScheduleTime, { readonly kind: 'range' }> = {
  kind: 'range',
  from: Temporal.PlainTime.from('14:00'),
  to: Temporal.PlainTime.from('18:00'),
};

/**
 * A schedule being edited the way Google Calendar edits a repeating event: times from the
 * system's time picker, a start date, a repeat menu with «Custom», a time zone — and the next
 * windows shown live.
 */
export class ScheduleEditor {
  zone: TScheduleZone;
  start: Temporal.PlainDate;
  times: readonly TScheduleTime[];
  repeat: IRecurrence | null;
  exceptDates: readonly Temporal.PlainDate[];

  constructor(
    initial: ISchedule | null,
    today: Temporal.PlainDate,
    phoneZone: string,
    private readonly expander: IRecurrenceExpander
  ) {
    this.zone = initial?.zone ?? { kind: 'fixed', zone: phoneZone };
    this.start = initial?.start ?? today;
    this.times = initial?.times ?? [WORK_DAY];
    this.repeat =
      initial === null ? presetRecurrence('weekdays', this.startWeekday) : initial.repeat;
    this.exceptDates = initial?.exceptDates ?? [];
    makeObservable<ScheduleEditor, 'startWeekday'>(this, {
      zone: observableRef,
      start: observableRef,
      times: observableRef,
      repeat: observableRef,
      exceptDates: observableRef,
      startWeekday: computed,
      preset: computed,
      allDay: computed,
      schedule: computed,
      upcoming: computed,
      setZone: action,
      setStart: action,
      setPreset: action,
      setRepeat: action,
      setAllDay: action,
      setTime: action,
      addTime: action,
      removeTime: action,
    });
  }

  private get startWeekday(): TWeekday {
    return this.start.dayOfWeek as TWeekday;
  }

  get preset(): TRepeatPreset {
    return presetOf(this.repeat, this.startWeekday);
  }

  get allDay(): boolean {
    return this.times.some(time => time.kind === 'all-day');
  }

  get schedule(): ISchedule {
    return {
      zone: this.zone,
      start: this.start,
      times: this.times,
      repeat: this.repeat,
      exceptDates: this.exceptDates,
    };
  }

  /** The next few windows, on the schedule's own clock, so the user sees what it really does. */
  get upcoming(): readonly IWindow[] {
    const occurrences = this.expander.occurrences(
      this.schedule,
      this.start,
      this.start.add({ days: LOOKAHEAD_DAYS })
    );
    const from = floatingMinute(this.start.toPlainDateTime());
    return scheduleWindows(this.schedule, occurrences)
      .filter(window => window.to > from)
      .slice(0, UPCOMING);
  }

  setZone(zone: TScheduleZone): void {
    this.zone = zone;
  }

  setStart(start: Temporal.PlainDate): void {
    const preset = this.preset;
    this.start = start;
    if (preset === 'weekly') {
      this.repeat = presetRecurrence('weekly', this.startWeekday);
    }
  }

  setPreset(preset: Exclude<TRepeatPreset, 'custom'>): void {
    this.repeat = presetRecurrence(preset, this.startWeekday);
  }

  /** «Custom…»: every N days, weeks, months or years, on chosen weekdays, ending or not. */
  setRepeat(repeat: IRecurrence): void {
    this.repeat =
      repeat.frequency === 'weekly' && repeat.weekdays.length === 0
        ? { ...repeat, weekdays: [this.startWeekday] }
        : repeat;
  }

  setAllDay(allDay: boolean): void {
    this.times = allDay ? [{ kind: 'all-day' }] : [WORK_DAY];
  }

  setTime(index: number, end: 'from' | 'to', time: Temporal.PlainTime): void {
    this.times = this.times.map((current, position) =>
      position !== index || current.kind !== 'range' ? current : { ...current, [end]: time }
    );
  }

  /** Another range: the afternoon, or the hour after the last range when that is taken. */
  addTime(): void {
    const ranges = this.times.filter(time => time.kind === 'range');
    const taken = ranges.some(
      time => time.from.equals(AFTERNOON.from) && time.to.equals(AFTERNOON.to)
    );
    const last = ranges.at(-1);
    const next: TScheduleTime =
      taken && last !== undefined
        ? { kind: 'range', from: last.to, to: last.to.add({ hours: 1 }) }
        : AFTERNOON;
    this.times = [...ranges, next];
  }

  removeTime(index: number): void {
    const rest = this.times.filter((_time, position) => position !== index);
    this.times = rest.length === 0 ? [WORK_DAY] : rest;
  }
}

export function withSchedule(policy: IPolicy, schedule: ISchedule | null): IPolicy {
  const scheduled = policy.scheduled ?? {
    schedule: null,
    calendars: [],
    places: [],
  };
  const next = { ...scheduled, schedule };
  return withConditions(policy, next);
}
