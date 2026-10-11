import { assertNever } from '@frozik/utils/assert/assertNever';
import type { IAgentTool } from '@frozik/utils/webmcp/agentTool';
import { defineAgentTool, refuse } from '@frozik/utils/webmcp/agentTool';
import type { Temporal } from 'temporal-polyfill';
import { z } from 'zod';

import { formatMonthYear, readMonthYearText } from './month-year-input';

/** `<name>_read` and `<name>_enter` for one `MonthYearEditor`; text goes through the field's own `MM/YY` rules. */
export function defineMonthYearEditorTools({
  name,
  label,
  getValue,
  setValue,
}: {
  readonly name: string;
  readonly label: string;
  readonly getValue: () => Temporal.PlainYearMonth | undefined;
  readonly setValue: (value: Temporal.PlainYearMonth | undefined) => void;
}): readonly IAgentTool[] {
  return [
    defineAgentTool({
      name: `${name}_read`,
      title: `Read ${label}`,
      description: `Reads the "${label}" month as MM/YY and as an ISO year-month.`,
      input: z.object({}),
      readOnly: true,
      execute: () => ({ text: formatMonthYear(getValue()), iso: getValue()?.toString() ?? null }),
    }),
    defineAgentTool({
      name: `${name}_enter`,
      title: `Enter ${label}`,
      description: `Sets "${label}" from MM/YY, MM/YYYY or ISO YYYY-MM, e.g. "12/29"; empty text clears it.`,
      input: z.object({ text: z.string() }),
      execute: ({ text }) => {
        const result = readMonthYearText(text);
        switch (result.kind) {
          case 'empty':
            setValue(undefined);
            return { text: '', iso: null };
          case 'value':
            setValue(result.value);
            return { text: formatMonthYear(result.value), iso: result.value.toString() };
          case 'incomplete':
          case 'invalid':
            return refuse(`"${text}" is not a month as MM/YY.`);
          default:
            return assertNever(result);
        }
      },
    }),
  ];
}
