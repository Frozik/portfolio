import { observer } from 'mobx-react-lite';

import { Button } from '../../../../shared/ui/Button';
import type { TSymptom } from '../../application/BugReporterDemoStore';
import { useBugReporterDemoStore } from '../../application/useBugReporterDemoStore';
import { bugReporterDemoT } from '../translations';
import { DeskPanel } from './DeskPanel';

const SYMPTOMS: readonly TSymptom[] = ['transfer', 'recalculate', 'quotes', 'shuffle', 'console'];

export const SymptomsPanel = observer(() => {
  const store = useBugReporterDemoStore();
  const actions: Readonly<Record<TSymptom, () => void>> = {
    transfer: store.submitTransfer,
    recalculate: store.recalculatePortfolio,
    quotes: store.refreshQuotes,
    shuffle: store.shuffleWidgets,
    console: store.floodConsole,
  };
  return (
    <DeskPanel title={bugReporterDemoT.panels.symptoms}>
      <ul className="flex flex-col gap-2">
        {SYMPTOMS.map(symptom => (
          <li key={symptom} className="flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              size="sm"
              disabled={symptom === 'quotes' && store.quotesPending}
              onClick={actions[symptom]}
            >
              {bugReporterDemoT.symptoms[symptom]}
            </Button>
            <span className="text-right text-[11px] text-landing-fg-faint">
              {bugReporterDemoT.symptomHints[symptom]}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-col gap-1 border-t border-landing-border-soft pt-3">
        <span className="text-xs text-landing-fg-dim">{bugReporterDemoT.activity}</span>
        {store.activity.length === 0 ? (
          <span className="text-[11px] text-landing-fg-faint">{bugReporterDemoT.noActivity}</span>
        ) : (
          <ol className="flex flex-col gap-0.5 font-mono text-[11px] text-landing-fg-faint">
            {store.activity.map(line => (
              <li key={line.id}>
                #{line.id} {bugReporterDemoT.symptoms[line.symptom]}
              </li>
            ))}
          </ol>
        )}
      </div>
    </DeskPanel>
  );
});
