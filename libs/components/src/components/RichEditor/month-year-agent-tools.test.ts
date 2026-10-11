import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import { defineMonthYearEditorTools } from './month-year-agent-tools';

describe('month and year tools', () => {
  it('enter a month the way the field reads typing, and refuse what is not one', async () => {
    let value: Temporal.PlainYearMonth | undefined;
    const tools = defineMonthYearEditorTools({
      name: 'expiry',
      label: 'Expiry',
      getValue: () => value,
      setValue: next => {
        value = next;
      },
    });
    const call = (name: string, input: object) => {
      const tool = tools.find(candidate => candidate.name === name);
      assert(!isNil(tool));
      return tool.run(input, new AbortController().signal);
    };

    await expect(call('expiry_enter', { text: '12/29' })).resolves.toEqual({
      text: '12/29',
      iso: '2029-12',
    });
    await expect(call('expiry_enter', { text: '13/29' })).resolves.toMatchObject({
      error: expect.any(String),
    });
    expect(value?.equals(Temporal.PlainYearMonth.from('2029-12'))).toBe(true);
    await expect(call('expiry_enter', { text: '2031-05' })).resolves.toEqual({
      text: '05/31',
      iso: '2031-05',
    });
    await expect(call('expiry_enter', { text: '12/20299' })).resolves.toMatchObject({
      error: expect.any(String),
    });
    await call('expiry_enter', { text: '12/2029' });
    await expect(call('expiry_read', {})).resolves.toEqual({ text: '12/29', iso: '2029-12' });
  });
});
