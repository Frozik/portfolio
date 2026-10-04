import { memo } from 'react';

import { bugReporterDemoT } from '../translations';
import { DeskPanel } from './DeskPanel';

const GuidePanelComponent = () => (
  <DeskPanel title={bugReporterDemoT.guide.title} className="lg:col-span-2">
    <ul className="flex flex-col gap-2 text-sm leading-relaxed text-landing-fg-dim">
      <li>{bugReporterDemoT.guide.hidden}</li>
      <li>{bugReporterDemoT.guide.archive}</li>
      <li>{bugReporterDemoT.guide.delivery}</li>
    </ul>
  </DeskPanel>
);

export const GuidePanel = memo(GuidePanelComponent);
