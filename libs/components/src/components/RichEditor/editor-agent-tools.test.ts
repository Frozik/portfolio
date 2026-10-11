import { assert } from '@frozik/utils/assert/assert';
import { parseFuzzyDate } from '@frozik/utils/date/fuzzy/parseFuzzyDate';
import type { IAgentTool } from '@frozik/utils/webmcp/agentTool';
import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import {
  defineCheckboxTools,
  defineDateTimePickerTools,
  defineMaskedEditorTools,
  defineMultilineEditorTools,
  defineNumericEditorTools,
  defineTabsTools,
  defineUrlEditorTools,
} from './editor-agent-tools';
import { MASKS } from './masked-input';
import type { INumericFieldFormat } from './numeric-entry';

const NOW = Temporal.Instant.from('2026-10-04T09:00:00Z');
const TIME_ZONE = 'Europe/Moscow';

function caller(tools: readonly IAgentTool[]) {
  return (name: string, input: object = {}): Promise<unknown> => {
    const tool = tools.find(candidate => candidate.name === name);
    assert(!isNil(tool), `no ${name} tool`);
    return tool.run(input, new AbortController().signal);
  };
}

function numberField(format: INumericFieldFormat) {
  let value: number | undefined;
  const call = caller(
    defineNumericEditorTools({
      name: 'rate',
      label: 'Rate',
      getValue: () => value,
      setValue: next => {
        value = next;
      },
      getFormat: () => format,
    })
  );
  return { call, value: () => value };
}

function dateField(range: { readonly minDate?: Temporal.PlainDate } = {}) {
  let value: Temporal.ZonedDateTime | undefined;
  const call = caller(
    defineDateTimePickerTools({
      name: 'when',
      label: 'When',
      getValue: () => value,
      setValue: next => {
        value = next;
      },
      parse: parseFuzzyDate,
      getNow: () => NOW,
      getRange: () => ({ timeZone: TIME_ZONE, ...range }),
    })
  );
  return { call, value: () => value };
}

describe('numeric editor tools', () => {
  it('settle typed text as the editor does: suffixes expand, the value rounds to the display scale', async () => {
    const field = numberField({ decimal: 2, allowNegative: false });

    await expect(field.call('rate_enter', { text: '12k' })).resolves.toEqual({
      value: 12000,
      text: '12000',
    });
    await expect(field.call('rate_enter', { text: '1.23456' })).resolves.toMatchObject({
      value: 1.23,
    });
    expect(field.value()).toBe(1.23);
  });

  it('round to the pip digits when they reach past the decimals, and clamp to the bounds', async () => {
    const field = numberField({ decimal: 2, pipStart: 2, pipSize: 2, max: 5 });

    await expect(field.call('rate_enter', { text: '1.234567' })).resolves.toMatchObject({
      value: 1.2346,
    });
    await expect(field.call('rate_enter', { text: '9' })).resolves.toMatchObject({ value: 5 });
  });

  it('refuse text the editor would not accept, leaving the value as it was', async () => {
    const field = numberField({ allowNegative: false });
    await field.call('rate_enter', { text: '7' });

    await expect(field.call('rate_enter', { text: '-3' })).resolves.toEqual({
      error: '"-3" is not a number this field accepts.',
    });
    expect(field.value()).toBe(7);
  });

  it('read the value with the rule it follows', async () => {
    const field = numberField({ decimal: 3, allowNegative: true });

    await expect(field.call('rate_read')).resolves.toEqual({
      value: null,
      rule: 'The value is rounded to 3 decimals, may be negative.',
    });
  });
});

describe('date-time picker tools', () => {
  it('read natural language with the picker parser, in the picker zone', async () => {
    const field = dateField();

    await expect(field.call('when_enter', { text: 'tomorrow 13:00' })).resolves.toEqual({
      value: '2026-10-05T13:00:00+03:00[Europe/Moscow]',
      display: '2026-10-05 13:00',
    });
  });

  it('clamp to the earliest date the picker allows, keeping the time', async () => {
    const field = dateField({ minDate: Temporal.PlainDate.from('2026-11-01') });

    await expect(field.call('when_enter', { text: 'tomorrow 13:00' })).resolves.toMatchObject({
      display: '2026-11-01 13:00',
    });
  });

  it('report why text cannot be read and clear the field on empty text', async () => {
    const field = dateField();
    await field.call('when_enter', { text: 'tomorrow' });

    await expect(field.call('when_enter', { text: 'whenever' })).resolves.toEqual({
      error: 'Cannot parse "whenever"',
    });
    await expect(field.call('when_enter', { text: ' ' })).resolves.toEqual({
      value: null,
      display: '',
    });
    expect(field.value()).toBeUndefined();
  });
});

function textField(define: typeof defineUrlEditorTools) {
  let value = '';
  const call = caller(
    define({
      name: 'site',
      label: 'Site',
      getValue: () => value,
      setValue: next => {
        value = next;
      },
    })
  );
  return { call, value: () => value };
}

describe('text field tools', () => {
  it('keep only what the mask accepts, as typing would', async () => {
    let value = '';
    const call = caller(
      defineMaskedEditorTools({
        name: 'iban',
        label: 'IBAN',
        getValue: () => value,
        setValue: next => {
          value = next;
        },
        mask: MASKS.iban,
        accepts: 'letters and digits',
      })
    );

    await expect(call('iban_enter', { text: 'de89 3704-0044 0532 0130 00' })).resolves.toEqual({
      value: 'DE89370400440532013000',
    });
    await expect(call('iban_read')).resolves.toEqual({ value: 'DE89370400440532013000' });
  });

  it('drop spaces from an address and keep line breaks in a note', async () => {
    const site = textField(defineUrlEditorTools);
    await site.call('site_enter', { text: ' bank.example /login ' });
    expect(site.value()).toBe('bank.example/login');

    const note = textField(defineMultilineEditorTools);
    await note.call('site_enter', { text: 'one\ntwo' });
    expect(note.value()).toBe('one\ntwo');
  });
});

describe('choice tools', () => {
  it('tick a checkbox and read it back', async () => {
    let checked = false;
    const call = caller(
      defineCheckboxTools({
        name: 'favorite',
        label: 'Favorite',
        getChecked: () => checked,
        setChecked: next => {
          checked = next;
        },
      })
    );

    await call('favorite_set', { checked: true });
    await expect(call('favorite_read')).resolves.toEqual({ checked: true });
  });

  it('open a tab by id and refuse one that does not exist', async () => {
    let active = 'main';
    const call = caller(
      defineTabsTools({
        name: 'card',
        label: 'Card',
        getTabs: () => [
          { id: 'main', label: 'Main' },
          { id: 'bank', label: 'Bank' },
        ],
        getActive: () => active,
        setActive: id => {
          active = id;
        },
      })
    );

    await expect(call('card_open', { id: 'bank' })).resolves.toEqual({ active: 'bank' });
    await expect(call('card_open', { id: 'nope' })).resolves.toMatchObject({
      error: expect.any(String),
    });
    expect(active).toBe('bank');
  });
});
