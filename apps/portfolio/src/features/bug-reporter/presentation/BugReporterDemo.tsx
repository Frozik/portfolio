import '@frozik/bug-reporter/theme/bug-reporter.css';
import '@frozik/table/theme/table.css';

import { BugReporterWidget } from '@frozik/bug-reporter/react/BugReporterWidget';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { observer } from 'mobx-react-lite';

import { SectionNumber } from '../../../shared/ui/SectionNumber';
import type { TDeskPanel } from '../application/BugReporterDemoStore';
import { useBugReporterDemoStore } from '../application/useBugReporterDemoStore';
import { AccountsPanel } from './components/AccountsPanel';
import { GuidePanel } from './components/GuidePanel';
import { NewsPanel } from './components/NewsPanel';
import { PositionsPanel } from './components/PositionsPanel';
import { SymptomsPanel } from './components/SymptomsPanel';
import { bugReporterDemoT } from './translations';

function renderPanel(panel: TDeskPanel) {
  switch (panel) {
    case 'accounts':
      return <AccountsPanel key={panel} />;
    case 'positions':
      return <PositionsPanel key={panel} />;
    case 'news':
      return <NewsPanel key={panel} />;
    case 'symptoms':
      return <SymptomsPanel key={panel} />;
    default:
      return assertNever(panel);
  }
}

export const BugReporterDemo = observer(() => {
  const store = useBugReporterDemoStore();
  return (
    <div className="relative flex flex-col">
      <div className="mx-auto flex w-full max-w-[var(--container-narrow)] flex-col gap-10 px-6 pt-12 pb-24 sm:px-8">
        <section className="flex flex-col gap-6">
          <SectionNumber number="01" label={bugReporterDemoT.kicker} />
          <div className="flex flex-col gap-4">
            <h1 className="text-[clamp(36px,7vw,56px)] font-medium leading-[1.02] tracking-[-0.03em] text-landing-fg">
              {bugReporterDemoT.headlinePrimary}
              <br />
              <span className="font-serif text-landing-fg-faint italic">
                {bugReporterDemoT.headlineAccent}
              </span>
            </h1>
            <p className="max-w-[640px] text-[15px] leading-[1.5] text-landing-fg-dim">
              {bugReporterDemoT.subtitle}
            </p>
          </div>
        </section>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {store.panels.map(renderPanel)}
          <GuidePanel />
        </div>
      </div>
      <BugReporterWidget reporter={store.reporter} locale={store.locale} />
    </div>
  );
});
