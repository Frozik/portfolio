import type { DateTimeParseResult, IParseContext } from '@frozik/utils/date/fuzzy/types';
import type { IAgentTool } from '@frozik/utils/webmcp/agentTool';
import { defineAgentTool, refuse } from '@frozik/utils/webmcp/agentTool';
import { isNil } from 'lodash-es';
import type { Temporal } from 'temporal-polyfill';
import { z } from 'zod';

import { clampToDateRange } from './date-entry';
import { defaultFormatDate } from './date-format';
import type { TMask } from './masked-input';
import { enterMaskedText } from './masked-input';
import type { INumericFieldFormat } from './numeric-entry';
import { enterNumericText, settledDecimals } from './numeric-entry';
import { formatNumericValue } from './numeric-input';
import { normalizeUrlInput } from './url-input';

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

/**
 * `<name>_read` and `<name>_enter` for one `MaskedEditor`. Entering goes
 * through the mask, so the agent gets exactly the characters a person typing
 * the same text would: anything the mask does not accept is dropped.
 */
export function defineMaskedEditorTools({
  name,
  label,
  getValue,
  setValue,
  mask,
  accepts,
}: {
  readonly name: string;
  readonly label: string;
  readonly getValue: () => string;
  readonly setValue: (value: string) => void;
  readonly mask: TMask;
  /** What the field takes, for the agent: "digits and a leading +", "letters and digits, up to 34". */
  readonly accepts: string;
}): readonly IAgentTool[] {
  return [
    defineAgentTool({
      name: `${name}_read`,
      title: `Read ${label}`,
      description: `Reads the "${label}" field. It takes ${accepts}.`,
      input: z.object({}),
      readOnly: true,
      execute: () => ({ value: getValue() }),
    }),
    defineAgentTool({
      name: `${name}_enter`,
      title: `Enter ${label}`,
      description: `Types text into the "${label}" field as a person would; it keeps ${accepts} and drops the rest. Returns the stored value.`,
      input: textInput,
      execute: ({ text }) => {
        const value = enterMaskedText(text, mask);
        setValue(value);
        return { value };
      },
    }),
  ];
}

/** `<name>_read` and `<name>_enter` for one `TextEditor`: the text as given. */
export function defineTextEditorTools({
  name,
  label,
  getValue,
  setValue,
}: {
  readonly name: string;
  readonly label: string;
  readonly getValue: () => string;
  readonly setValue: (value: string) => void;
}): readonly IAgentTool[] {
  return [
    defineAgentTool({
      name: `${name}_read`,
      title: `Read ${label}`,
      description: `Reads the "${label}" field.`,
      input: z.object({}),
      readOnly: true,
      execute: () => ({ value: getValue() }),
    }),
    defineAgentTool({
      name: `${name}_enter`,
      title: `Enter ${label}`,
      description: `Types text into the "${label}" field. Returns the stored value.`,
      input: textInput,
      execute: ({ text }) => {
        setValue(text);
        return { value: text };
      },
    }),
  ];
}

/** `<name>_read` and `<name>_enter` for one `UrlEditor`: spaces go, as when a person pastes an address. */
export function defineUrlEditorTools({
  name,
  label,
  getValue,
  setValue,
}: {
  readonly name: string;
  readonly label: string;
  readonly getValue: () => string;
  readonly setValue: (value: string) => void;
}): readonly IAgentTool[] {
  return [
    defineAgentTool({
      name: `${name}_read`,
      title: `Read ${label}`,
      description: `Reads the "${label}" address field.`,
      input: z.object({}),
      readOnly: true,
      execute: () => ({ value: getValue() }),
    }),
    defineAgentTool({
      name: `${name}_enter`,
      title: `Enter ${label}`,
      description: `Types an address into the "${label}" field; spaces are dropped. Returns the stored value.`,
      input: textInput,
      execute: ({ text }) => {
        const value =
          normalizeUrlInput(text, { start: text.length, end: text.length })?.value ?? '';
        setValue(value);
        return { value };
      },
    }),
  ];
}

/** `<name>_read` and `<name>_set` for one `Checkbox`. */
export function defineCheckboxTools({
  name,
  label,
  getChecked,
  setChecked,
}: {
  readonly name: string;
  readonly label: string;
  readonly getChecked: () => boolean;
  readonly setChecked: (checked: boolean) => void;
}): readonly IAgentTool[] {
  return [
    defineAgentTool({
      name: `${name}_read`,
      title: `Read ${label}`,
      description: `Reads whether "${label}" is ticked.`,
      input: z.object({}),
      readOnly: true,
      execute: () => ({ checked: getChecked() }),
    }),
    defineAgentTool({
      name: `${name}_set`,
      title: `Set ${label}`,
      description: `Ticks or clears "${label}".`,
      input: z.object({ checked: z.boolean() }),
      execute: ({ checked }) => {
        setChecked(checked);
        return { checked };
      },
    }),
  ];
}

/** `<name>_read` and `<name>_enter` for one `MultilineEditor`; line breaks are kept. */
export function defineMultilineEditorTools({
  name,
  label,
  getValue,
  setValue,
}: {
  readonly name: string;
  readonly label: string;
  readonly getValue: () => string;
  readonly setValue: (value: string) => void;
}): readonly IAgentTool[] {
  return [
    defineAgentTool({
      name: `${name}_read`,
      title: `Read ${label}`,
      description: `Reads the "${label}" text, several lines.`,
      input: z.object({}),
      readOnly: true,
      execute: () => ({ value: getValue() }),
    }),
    defineAgentTool({
      name: `${name}_enter`,
      title: `Enter ${label}`,
      description: `Replaces the "${label}" text; line breaks are kept.`,
      input: textInput,
      execute: ({ text }) => {
        setValue(text);
        return { value: text };
      },
    }),
  ];
}

/** `<name>_read` and `<name>_open` for one `Tabs`: the agent sees every tab and opens one by id. */
export function defineTabsTools({
  name,
  label,
  getTabs,
  getActive,
  setActive,
}: {
  readonly name: string;
  readonly label: string;
  readonly getTabs: () => readonly { readonly id: string; readonly label: string }[];
  readonly getActive: () => string;
  readonly setActive: (id: string) => void;
}): readonly IAgentTool[] {
  return [
    defineAgentTool({
      name: `${name}_read`,
      title: `Read ${label}`,
      description: `Lists the "${label}" tabs and says which one is open.`,
      input: z.object({}),
      readOnly: true,
      execute: () => ({ tabs: getTabs(), active: getActive() }),
    }),
    defineAgentTool({
      name: `${name}_open`,
      title: `Open ${label} tab`,
      description: `Opens one of the "${label}" tabs by its id, as read with ${name}_read.`,
      input: z.object({ id: z.string() }),
      execute: ({ id }) => {
        if (!getTabs().some(tab => tab.id === id)) {
          return refuse(`There is no "${id}" tab.`);
        }
        setActive(id);
        return { active: id };
      },
    }),
  ];
}
