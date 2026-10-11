import {
  defineCheckboxTools,
  defineMaskedEditorTools,
  defineMultilineEditorTools,
  defineTabsTools,
  defineTextEditorTools,
  defineUrlEditorTools,
} from '@frozik/components/components/RichEditor/editor-agent-tools';
import { MASKS } from '@frozik/components/components/RichEditor/masked-input';
import { defineMonthYearEditorTools } from '@frozik/components/components/RichEditor/month-year-agent-tools';
import {
  defineComboboxTools,
  defineMultiSelectTools,
  defineSelectTools,
} from '@frozik/components/components/select/select-agent-tools';
import type { IAgentTool } from '@frozik/utils/webmcp/agentTool';

import type { FormControlsDemo, TCurrency, TFormTab, TGroup } from './FormControlsDemo';
import { BANK_SUGGESTIONS, CURRENCIES, FORM_TABS, GROUPS } from './FormControlsDemo';

function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return values.some(candidate => candidate === value);
}

/**
 * The form showcase through the library's own tools. The password field has
 * none on purpose; the backup codes and the file drop
 * neither: a list is its items, and a file is not text an agent can hand over.
 */
export function createFormAgentTools(
  form: FormControlsDemo,
  locale: string
): readonly IAgentTool[] {
  return [
    ...defineTabsTools({
      name: 'controls_form_tab',
      label: 'Form section',
      getTabs: () => FORM_TABS.map(id => ({ id, label: id })),
      getActive: () => form.tab,
      setActive: id => {
        if (isOneOf<TFormTab>(FORM_TABS, id)) {
          form.setTab(id);
        }
      },
    }),
    ...defineUrlEditorTools({
      name: 'controls_form_site',
      label: 'Website',
      getValue: () => form.site,
      setValue: form.setSite,
    }),
    ...defineTextEditorTools({
      name: 'controls_form_login',
      label: 'Login',
      getValue: () => form.login,
      setValue: form.setLogin,
    }),
    ...defineMultiSelectTools({
      name: 'controls_form_groups',
      label: 'Groups',
      getOptions: () => GROUPS.map(value => ({ value, label: value })),
      getValues: () => form.groups,
      setValues: values => form.setGroups(values.filter(value => isOneOf<TGroup>(GROUPS, value))),
    }),
    ...defineCheckboxTools({
      name: 'controls_form_favorite',
      label: 'Favorite',
      getChecked: () => form.favorite,
      setChecked: form.setFavorite,
    }),
    ...defineComboboxTools({
      name: 'controls_form_bank',
      label: 'Bank',
      getSuggestions: () => BANK_SUGGESTIONS,
      getValue: () => form.bank,
      setValue: form.setBank,
      locale,
    }),
    ...defineMaskedEditorTools({
      name: 'controls_form_iban',
      label: 'IBAN',
      getValue: () => form.iban,
      setValue: form.setIban,
      mask: MASKS.iban,
      accepts: 'letters and digits, up to 34',
    }),
    ...defineMaskedEditorTools({
      name: 'controls_form_phone',
      label: 'Bank phone',
      getValue: () => form.phone,
      setValue: form.setPhone,
      mask: MASKS.phone,
      accepts: 'digits and a leading +',
    }),
    ...defineMonthYearEditorTools({
      name: 'controls_form_expiry',
      label: 'Card expiry',
      getValue: () => form.expiry,
      setValue: form.setExpiry,
    }),
    ...defineSelectTools({
      name: 'controls_form_currency',
      label: 'Currency',
      getOptions: () => CURRENCIES.map(value => ({ value, label: value })),
      getValue: () => form.currency,
      setValue: value => {
        if (isOneOf<TCurrency>(CURRENCIES, value)) {
          form.setCurrency(value);
        }
      },
    }),
    ...defineMultilineEditorTools({
      name: 'controls_form_notes',
      label: 'Notes',
      getValue: () => form.notes,
      setValue: form.setNotes,
    }),
  ];
}
