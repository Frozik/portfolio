import type { DateTimeParseResult, IParseContext } from '@frozik/utils/date/fuzzy/types';
import type { IAgentTool } from '@frozik/utils/webmcp/agentTool';
import { defineAgentTool, refuse } from '@frozik/utils/webmcp/agentTool';
import { isNil } from 'lodash-es';
import type { Temporal } from 'temporal-polyfill';
import { z } from 'zod';

import { clampToDateRange } from './date-entry';
import { defaultFormatDate } from './date-format';
import type { INumericFieldFormat } from './numeric-entry';
import { enterNumericText, settledDecimals } from './numeric-entry';
import { formatNumericValue } from './numeric-input';

const textInput = z.object({
  text: z.string().describe('Exactly what a person would type into the field.'),
});

function roundingRule(format: INumericFieldFormat): string {
  const decimals = settledDecimals(format);
  const rules = [
    isNil(decimals) ? 'keeps every typed decimal' : `is rounded to ${decimals} decimals`,
    format.allowNegative ? 'may be negative' : 'cannot be negative',
  ];
  if (!isNil(format.min)) {
    rules.push(`is raised to at least ${format.min}`);
  }
  if (!isNil(format.max)) {
    rules.push(`is lowered to at most ${format.max}`);
  }
  return rules.join(', ');
}

/**
 * `<name>_read` and `<name>_enter` for one `NumericEditor`. Entering goes through the
 * editor's own normalisation, rounding and clamping, so the agent gets exactly the value
 * a person typing the same text would.
 */
export function defineNumericEditorTools({
  name,
  label,
  getValue,
  setValue,
  getFormat,
}: {
  readonly name: string;
  readonly label: string;
  readonly getValue: () => number | undefined;
  readonly setValue: (value: number | undefined) => void;
  readonly getFormat: () => INumericFieldFormat;
}): readonly IAgentTool[] {
  return [
    defineAgentTool({
      name: `${name}_read`,
      title: `Read ${label}`,
      description: `Reads the "${label}" number field and the rule its value follows.`,
      input: z.object({}),
      readOnly: true,
      execute: () => ({
        value: getValue() ?? null,
        rule: `The value ${roundingRule(getFormat())}.`,
      }),
    }),
    defineAgentTool({
      name: `${name}_enter`,
      title: `Enter ${label}`,
      description:
        `Types text into the "${label}" number field and leaves it, as a person would: ` +
        'digits with one ".", a leading "-" when negatives are allowed, and one k/m/b that ' +
        'appends 3/6/9 zeros in place ("12k" is 12000). An empty text clears the field. ' +
        'Returns the value the field settled on.',
      input: textInput,
      execute: ({ text }) => {
        const entry = enterNumericText(text, getFormat());
        if ('error' in entry) {
          return refuse(entry.error);
        }
        setValue(entry.value);
        return { value: entry.value ?? null, text: formatNumericValue(entry.value) };
      },
    }),
  ];
}

/**
 * `<name>_read` and `<name>_enter` for one `DateTimePicker`. Entering parses the text
 * with the picker's own parser and clamps it to its date range, so natural language
 * ("tomorrow 13:00", "next fri") works for the agent exactly as for a person.
 */
export function defineDateTimePickerTools({
  name,
  label,
  getValue,
  setValue,
  parse,
  getNow,
  getRange,
  formatDate = defaultFormatDate,
}: {
  readonly name: string;
  readonly label: string;
  readonly getValue: () => Temporal.ZonedDateTime | undefined;
  readonly setValue: (value: Temporal.ZonedDateTime | undefined) => void;
  readonly parse: (text: string, context: IParseContext) => DateTimeParseResult;
  readonly getNow: () => Temporal.Instant;
  readonly getRange: () => {
    readonly timeZone: string;
    readonly minDate?: Temporal.PlainDate;
    readonly maxDate?: Temporal.PlainDate;
  };
  readonly formatDate?: (value: Temporal.ZonedDateTime) => string;
}): readonly IAgentTool[] {
  const describe = (value: Temporal.ZonedDateTime | undefined) =>
    isNil(value)
      ? { value: null, display: '' }
      : { value: value.toString(), display: formatDate(value) };

  return [
    defineAgentTool({
      name: `${name}_read`,
      title: `Read ${label}`,
      description: `Reads the "${label}" date field: the ISO value, what it shows and its time zone.`,
      input: z.object({}),
      readOnly: true,
      execute: () => ({ ...describe(getValue()), timeZone: getRange().timeZone }),
    }),
    defineAgentTool({
      name: `${name}_enter`,
      title: `Enter ${label}`,
      description:
        `Types text into the "${label}" date field and leaves it, as a person would. It ` +
        'understands natural language and ISO: "tomorrow 13:00", "next fri 9am", "in 3 days", ' +
        '"end of month", "2025-01-15 14:30". An empty text clears the field. Text the field ' +
        'cannot read comes back as an error with the reason.',
      input: textInput,
      execute: ({ text }) => {
        const trimmed = text.trim();
        if (trimmed.length === 0) {
          setValue(undefined);
          return describe(undefined);
        }
        const { timeZone, minDate, maxDate } = getRange();
        const result = parse(trimmed, { now: getNow(), timeZone });
        if (!result.success) {
          return refuse(result.reason);
        }
        const value = clampToDateRange(result.value, { minDate, maxDate });
        setValue(value);
        return describe(value);
      },
    }),
  ];
}
