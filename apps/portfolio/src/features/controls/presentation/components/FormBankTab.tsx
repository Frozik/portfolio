import { MASKS } from '@frozik/components/components/RichEditor/masked-input';
import { MaskedEditor } from '@frozik/components/components/RichEditor/MaskedEditor';
import { MonthYearEditor } from '@frozik/components/components/RichEditor/MonthYearEditor';
import { Combobox } from '@frozik/components/components/select/Combobox';
import { Select } from '@frozik/components/components/select/Select';
import { observer } from 'mobx-react-lite';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { CardFrame } from '../../../../shared/ui/CardFrame';
import { BANK_SUGGESTIONS, CURRENCIES, CURRENCY_DETAILS } from '../../application/FormControlsDemo';
import { useControlsDemoStore } from '../../application/useControlsDemoStore';
import { controlsT } from '../translations';
import { FormField } from './FormField';

export const FormBankTab = observer(() => {
  const { form } = useControlsDemoStore();
  const t = controlsT.formPage;
  const locale = getCurrentLanguage();

  return (
    <CardFrame className="flex flex-col gap-5 p-6">
      <FormField label={t.bank}>
        <Combobox
          aria-label={t.bank}
          placeholder={t.bankPlaceholder}
          suggestions={BANK_SUGGESTIONS}
          value={form.bank}
          onValueChange={form.setBank}
          locale={locale}
        />
      </FormField>
      <FormField label={t.iban}>
        <MaskedEditor
          aria-label={t.iban}
          mask={MASKS.iban}
          value={form.iban}
          onValueChange={form.setIban}
          placeholder="DE89 3704 0044 0532 0130 00"
        />
      </FormField>
      <FormField label={t.phone}>
        <MaskedEditor
          aria-label={t.phone}
          mask={MASKS.phone}
          value={form.phone}
          onValueChange={form.setPhone}
          placeholder="+49 69 9100 0"
        />
      </FormField>
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label={t.expiry}>
          <MonthYearEditor
            aria-label={t.expiry}
            value={form.expiry}
            onValueChange={form.setExpiry}
            locale={locale}
          />
        </FormField>
        <FormField label={t.currency}>
          <Select
            aria-label={t.currency}
            placeholder={t.currencyPlaceholder}
            options={CURRENCIES.map(value => ({
              value,
              label: t.currencyNames[value],
              group: t.currencyRegions[CURRENCY_DETAILS[value].region],
              decoration: CURRENCY_DETAILS[value].sign,
            }))}
            value={form.currency}
            onValueChange={form.setCurrency}
            locale={locale}
          />
        </FormField>
      </div>
    </CardFrame>
  );
});
