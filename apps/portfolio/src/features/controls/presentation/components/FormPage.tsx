import { Tabs } from '@frozik/components/components/RichEditor/Tabs';
import { observer } from 'mobx-react-lite';

import { SectionNumber } from '../../../../shared/ui/SectionNumber';
import { FORM_TABS } from '../../application/FormControlsDemo';
import { useControlsDemoStore } from '../../application/useControlsDemoStore';
import { controlsT } from '../translations';
import { FormAccountTab } from './FormAccountTab';
import { FormBankTab } from './FormBankTab';
import { FormNotesTab } from './FormNotesTab';

const TAB_CONTENT = {
  account: <FormAccountTab />,
  bank: <FormBankTab />,
  notes: <FormNotesTab />,
} as const;

export const FormPage = observer(() => {
  const { form } = useControlsDemoStore();

  return (
    <section className="flex flex-col gap-5">
      <SectionNumber number="04" label={controlsT.formPage.sectionKicker} />
      <h2 className="text-[24px] font-medium text-landing-fg">{controlsT.formPage.title}</h2>
      <p className="text-[14px] leading-[1.55] text-landing-fg-dim">
        {controlsT.formPage.description}
      </p>
      <Tabs
        aria-label={controlsT.formPage.tabsLabel}
        value={form.tab}
        onValueChange={form.setTab}
        tabs={FORM_TABS.map(id => ({
          id,
          label: controlsT.formPage.tabs[id],
          content: TAB_CONTENT[id],
        }))}
      />
    </section>
  );
});
