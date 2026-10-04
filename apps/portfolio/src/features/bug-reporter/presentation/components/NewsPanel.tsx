import { observer } from 'mobx-react-lite';

import { useBugReporterDemoStore } from '../../application/useBugReporterDemoStore';
import { bugReporterDemoT } from '../translations';
import { DeskPanel } from './DeskPanel';

export const NewsPanel = observer(() => {
  const { desk } = useBugReporterDemoStore();
  return (
    <DeskPanel title={bugReporterDemoT.panels.news}>
      <ul className="flex flex-col gap-3">
        {desk.news.map(item => (
          <li key={item.id} className="flex flex-col gap-0.5">
            <span className="text-sm leading-snug text-landing-fg">{item.title}</span>
            <span className="font-mono text-[11px] text-landing-fg-faint">
              {item.source} · {bugReporterDemoT.minutesAgo(item.minutesAgo)}
            </span>
          </li>
        ))}
      </ul>
    </DeskPanel>
  );
});
