import { assert } from '@frozik/utils/assert/assert';
import type { IAgentTool } from '@frozik/utils/webmcp/agentTool';
import { isNil } from 'lodash-es';

import {
  defineComboboxTools,
  defineMultiSelectTools,
  defineSelectTools,
} from './select-agent-tools';

const OPTIONS = [
  { value: 'eur', label: 'Euro' },
  { value: 'usd', label: 'US dollar' },
  { value: 'rub', label: 'Rouble', disabled: true },
];

function caller(tools: readonly IAgentTool[]) {
  return (name: string, input: object = {}): Promise<unknown> => {
    const tool = tools.find(candidate => candidate.name === name);
    assert(!isNil(tool), `no ${name} tool`);
    return tool.run(input, new AbortController().signal);
  };
}

describe('select family tools', () => {
  it('choose an available option by value and refuse a disabled or unknown one', async () => {
    let value: string | undefined;
    const call = caller(
      defineSelectTools({
        name: 'currency',
        label: 'Currency',
        getOptions: () => OPTIONS,
        getValue: () => value,
        setValue: next => {
          value = next;
        },
      })
    );

    await expect(call('currency_choose', { value: 'usd' })).resolves.toEqual({ value: 'usd' });
    await expect(call('currency_choose', { value: 'rub' })).resolves.toMatchObject({
      error: expect.any(String),
    });
    await expect(call('currency_choose', { value: 'gbp' })).resolves.toMatchObject({
      error: expect.any(String),
    });
    await expect(call('currency_read')).resolves.toMatchObject({ value: 'usd' });
  });

  it('replace the whole set of chosen values, all or nothing', async () => {
    let values: readonly string[] = ['eur'];
    const call = caller(
      defineMultiSelectTools({
        name: 'accepted',
        label: 'Accepted',
        getOptions: () => OPTIONS,
        getValues: () => values,
        setValues: next => {
          values = next;
        },
      })
    );

    await call('accepted_set', { values: ['usd', 'rub'] });
    expect(values).toEqual(['eur']);
    await call('accepted_set', { values: ['usd'] });
    expect(values).toEqual(['usd']);
  });

  it('take free text in a combobox and show the suggestions it matches', async () => {
    let value = '';
    const call = caller(
      defineComboboxTools({
        name: 'bank',
        label: 'Bank',
        getSuggestions: () => ['Chase', 'Commerzbank', 'Deutsche Bank'],
        getValue: () => value,
        setValue: next => {
          value = next;
        },
        locale: 'en',
      })
    );

    await call('bank_enter', { text: 'ban' });
    await expect(call('bank_read')).resolves.toEqual({
      value: 'ban',
      suggestions: ['Commerzbank', 'Deutsche Bank'],
    });
  });
});
