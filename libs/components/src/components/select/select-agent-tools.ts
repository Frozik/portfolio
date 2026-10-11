import type { IAgentTool } from '@frozik/utils/webmcp/agentTool';
import { defineAgentTool, refuse } from '@frozik/utils/webmcp/agentTool';
import { isNil } from 'lodash-es';
import { z } from 'zod';

import type { IListboxOption } from './listbox-navigation';
import { matchingSuggestions } from './listbox-navigation';

function describeOptions(options: readonly IListboxOption<string>[]) {
  return options.map(({ value, label, disabled }) => ({
    value,
    label,
    disabled: disabled === true,
  }));
}

function isAvailable(options: readonly IListboxOption<string>[], value: string): boolean {
  return options.some(option => option.value === value && option.disabled !== true);
}

/** `<name>_read` and `<name>_choose` for one `Select`: the agent sees every option and picks one by value. */
export function defineSelectTools({
  name,
  label,
  getOptions,
  getValue,
  setValue,
}: {
  readonly name: string;
  readonly label: string;
  readonly getOptions: () => readonly IListboxOption<string>[];
  readonly getValue: () => string | undefined;
  readonly setValue: (value: string) => void;
}): readonly IAgentTool[] {
  return [
    defineAgentTool({
      name: `${name}_read`,
      title: `Read ${label}`,
      description: `Lists the options of "${label}" and says which one is chosen.`,
      input: z.object({}),
      readOnly: true,
      execute: () => ({ options: describeOptions(getOptions()), value: getValue() ?? null }),
    }),
    defineAgentTool({
      name: `${name}_choose`,
      title: `Choose ${label}`,
      description: `Chooses one option of "${label}" by its value, as read with ${name}_read.`,
      input: z.object({ value: z.string() }),
      execute: ({ value }) => {
        if (!isAvailable(getOptions(), value)) {
          return refuse(`"${value}" is not an option of "${label}" that can be chosen.`);
        }
        setValue(value);
        return { value };
      },
    }),
  ];
}

/** `<name>_read` and `<name>_set` for one `MultiSelect`: the agent replaces the whole set of chosen values. */
export function defineMultiSelectTools({
  name,
  label,
  getOptions,
  getValues,
  setValues,
}: {
  readonly name: string;
  readonly label: string;
  readonly getOptions: () => readonly IListboxOption<string>[];
  readonly getValues: () => readonly string[];
  readonly setValues: (values: readonly string[]) => void;
}): readonly IAgentTool[] {
  return [
    defineAgentTool({
      name: `${name}_read`,
      title: `Read ${label}`,
      description: `Lists the options of "${label}" and the values chosen.`,
      input: z.object({}),
      readOnly: true,
      execute: () => ({ options: describeOptions(getOptions()), values: getValues() }),
    }),
    defineAgentTool({
      name: `${name}_set`,
      title: `Set ${label}`,
      description: `Sets the values chosen in "${label}"; options left out are cleared.`,
      input: z.object({ values: z.array(z.string()) }),
      execute: ({ values }) => {
        const wrong = values.find(value => !isAvailable(getOptions(), value));
        if (!isNil(wrong)) {
          return refuse(`"${wrong}" is not an option of "${label}" that can be chosen.`);
        }
        setValues(values);
        return { values };
      },
    }),
  ];
}

/** `<name>_read` and `<name>_enter` for one `Combobox`: free text, with the suggestions that match it. */
export function defineComboboxTools({
  name,
  label,
  getSuggestions,
  getValue,
  setValue,
  locale,
}: {
  readonly name: string;
  readonly label: string;
  readonly getSuggestions: () => readonly string[];
  readonly getValue: () => string;
  readonly setValue: (value: string) => void;
  readonly locale: string;
}): readonly IAgentTool[] {
  return [
    defineAgentTool({
      name: `${name}_read`,
      title: `Read ${label}`,
      description: `Reads "${label}" and the suggestions matching it; any text is accepted.`,
      input: z.object({}),
      readOnly: true,
      execute: () => ({
        value: getValue(),
        suggestions: matchingSuggestions(getSuggestions(), getValue(), locale),
      }),
    }),
    defineAgentTool({
      name: `${name}_enter`,
      title: `Enter ${label}`,
      description: `Replaces the "${label}" text; a suggestion is not required.`,
      input: z.object({ text: z.string() }),
      execute: ({ text }) => {
        setValue(text);
        return { value: text };
      },
    }),
  ];
}
