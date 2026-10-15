import { FileDrop } from '@frozik/components/components/file-drop/FileDrop';
import { ListEditor } from '@frozik/components/components/RichEditor/ListEditor';
import { MASKS } from '@frozik/components/components/RichEditor/masked-input';
import { MaskedEditor } from '@frozik/components/components/RichEditor/MaskedEditor';
import { MultilineEditor } from '@frozik/components/components/RichEditor/MultilineEditor';
import { observer } from 'mobx-react-lite';

import { CardFrame } from '@frozik/components/ui/CardFrame';
import { pageLanguage } from '@frozik/utils/i18n/page-language';
import { useControlsDemoStore } from '../../application/useControlsDemoStore';
import { controlsT } from '../translations';
import { FormField } from './FormField';

export const FormNotesTab = observer(() => {
  const { form } = useControlsDemoStore();
  const t = controlsT.formPage;
  const locale = pageLanguage();

  return (
    <CardFrame className="flex flex-col gap-5 p-6">
      <FormField label={t.notes}>
        <MultilineEditor aria-label={t.notes} value={form.notes} onValueChange={form.setNotes} />
      </FormField>
      <FormField label={t.backupCodes}>
        <ListEditor
          items={form.backupCodes}
          onItemsChange={form.setBackupCodes}
          createItem={() => ''}
          isEmpty={code => code.length === 0}
          locale={locale}
          renderItem={(code, index, { onChange, ref }) => (
            <MaskedEditor
              ref={ref}
              aria-label={`${t.backupCode} ${index + 1}`}
              mask={MASKS.accountNumber}
              value={code}
              onValueChange={onChange}
            />
          )}
        />
      </FormField>
      <FormField label={t.attachments}>
        <FileDrop aria-label={t.attachments} multiple locale={locale} onFiles={form.addFiles} />
        {form.files.length > 0 && (
          <p className="text-[12px] text-landing-fg-dim">
            {t.attached} {form.files.map(file => file.name).join(', ')}
          </p>
        )}
      </FormField>
    </CardFrame>
  );
});
