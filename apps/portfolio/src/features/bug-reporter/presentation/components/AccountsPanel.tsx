import { observer } from 'mobx-react-lite';

import { Sparkline } from '../../../../shared/ui/Sparkline';
import { useBugReporterDemoStore } from '../../application/useBugReporterDemoStore';
import { totalBalance } from '../../domain/desk';
import { formatMoney } from '../money';
import { bugReporterDemoT } from '../translations';
import { DeskPanel } from './DeskPanel';

const SPARKLINE_WIDTH = 240;
const SPARKLINE_HEIGHT = 48;

export const AccountsPanel = observer(() => {
  const { desk } = useBugReporterDemoStore();
  return (
    <DeskPanel title={bugReporterDemoT.panels.accounts}>
      <ul className="flex flex-col gap-2">
        {desk.accounts.map(account => (
          <li key={account.id} className="flex items-baseline justify-between gap-4">
            <span className="flex flex-col">
              <span className="text-sm text-landing-fg">{account.name}</span>
              <span className="bug-mask font-mono text-[11px] text-landing-fg-faint">
                {account.iban}
              </span>
            </span>
            <span className="bug-mask rounded px-1 font-mono text-sm text-landing-fg tabular-nums">
              {formatMoney(account.balance, account.currency)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex items-baseline justify-between border-t border-landing-border-soft pt-3">
        <span className="text-xs text-landing-fg-dim">{bugReporterDemoT.total}</span>
        <span className="bug-mask rounded px-1 font-mono text-base font-medium text-landing-fg tabular-nums">
          {formatMoney(totalBalance(desk.accounts))}
        </span>
      </div>
      <div className="bug-block rounded">
        <Sparkline
          data={desk.equityCurve}
          viewBoxWidth={SPARKLINE_WIDTH}
          viewBoxHeight={SPARKLINE_HEIGHT}
          maxPoints={desk.equityCurve.length}
          stretchToFill
          className="h-12 w-full"
        />
      </div>
    </DeskPanel>
  );
});
