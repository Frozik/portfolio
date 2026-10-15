import { Checkbox } from '@frozik/components/components/RichEditor/Checkbox';
import { SecretEditor } from '@frozik/components/components/RichEditor/SecretEditor';
import { TextEditor } from '@frozik/components/components/RichEditor/TextEditor';
import { UrlEditor } from '@frozik/components/components/RichEditor/UrlEditor';
import { MultiSelect } from '@frozik/components/components/select/MultiSelect';
import { observer } from 'mobx-react-lite';

import { CardFrame } from '@frozik/components/ui/CardFrame';
import { pageLanguage } from '@frozik/utils/i18n/page-language';
import { GROUPS } from '../../application/FormControlsDemo';
import { useControlsDemoStore } from '../../application/useControlsDemoStore';
import { controlsT } from '../translations';
import { FormField } from './FormField';

/** How long a shown password stays readable before it hides itself. */
const REVEAL_TIMEOUT_MS = 5000;

export const FormAccountTab = observer(() => {
  const { form } = useControlsDemoStore();
  const t = controlsT.formPage;
  const locale = pageLanguage();

  return (
    <CardFrame className="flex flex-col gap-5 p-6">
      <FormField label={t.site}>
        <UrlEditor aria-label={t.site} value={form.site} onValueChange={form.setSite} />
      </FormField>
      <FormField label={t.login}>
        <TextEditor aria-label={t.login} value={form.login} onValueChange={form.setLogin} />
      </FormField>
      <FormField label={t.password} hint={t.passwordHint}>
        <SecretEditor
          aria-label={t.password}
          value={form.password}
          onValueChange={form.setPassword}
          revealTimeoutMs={REVEAL_TIMEOUT_MS}
          locale={locale}
        />
      </FormField>
      <FormField label={t.groups}>
        <MultiSelect
          aria-label={t.groups}
          placeholder={t.groupsPlaceholder}
          options={GROUPS.map(value => ({ value, label: t.groupNames[value] }))}
          values={form.groups}
          onValuesChange={form.setGroups}
          locale={locale}
        />
      </FormField>
      <Checkbox checked={form.favorite} onCheckedChange={form.setFavorite}>
        {t.favorite}
      </Checkbox>
    </CardFrame>
  );
});
