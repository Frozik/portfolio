import type { INumericFieldFormat } from '@frozik/components/components/RichEditor/numeric-entry';
import { EDateTimeStep, ETimeResolution } from '@frozik/utils/date/constants';
import { parseFuzzyDate } from '@frozik/utils/date/fuzzy/parseFuzzyDate';
import type { DateTimeParseResult, IParseContext } from '@frozik/utils/date/fuzzy/types';
import { sortBy } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import { Temporal } from 'temporal-polyfill';

/** Whether an ambiguous input like "mon" resolves forward only or to the closest date. */
export type ParseDirection = 'future' | 'nearest';

const DEFAULT_DECIMALS = 6;
const DEFAULT_PIP_RANGE: readonly [number, number] = [2, 4];

/** What both demo fields hold and how they are set up, for the page and for agents alike. */
export class ControlsDemoStore {
  numericValue: number | undefined = undefined;
  decimals = DEFAULT_DECIMALS;
  pipRange: readonly [number, number] = DEFAULT_PIP_RANGE;
  dateValue: Temporal.ZonedDateTime | undefined = undefined;
  step = EDateTimeStep.Day;
  timeResolution = ETimeResolution.Minutes;
  direction: ParseDirection = 'future';
  readonly timeZone = Temporal.Now.timeZoneId();

  constructor() {
    makeAutoObservable(this, { timeZone: false }, { autoBind: true });
  }

  /** The pip digits as first index and length; none when the range is empty. */
  get pip(): { readonly start: number; readonly size: number } | undefined {
    const [start, end] = sortBy(this.pipRange);
    return start === end ? undefined : { start, size: end - start };
  }

  get numericFormat(): INumericFieldFormat {
    return {
      decimal: this.decimals,
      pipStart: this.pip?.start,
      pipSize: this.pip?.size,
      allowNegative: true,
    };
  }

  parseDate(input: string, context: IParseContext): DateTimeParseResult {
    return parseFuzzyDate(input, { ...context, nearest: this.direction === 'nearest' });
  }

  setNumericValue(value: number | undefined): void {
    this.numericValue = value;
  }

  setDecimals(decimals: number): void {
    this.decimals = decimals;
  }

  setPipRange(range: readonly [number, number]): void {
    this.pipRange = range;
  }

  setDateValue(value: Temporal.ZonedDateTime | undefined): void {
    this.dateValue = value;
  }

  setStep(step: EDateTimeStep): void {
    this.step = step;
  }

  setTimeResolution(timeResolution: ETimeResolution): void {
    this.timeResolution = timeResolution;
  }

  setDirection(direction: ParseDirection): void {
    this.direction = direction;
  }

  dispose(): void {}
}
