import type { ChartModel } from '@frozik/charts/core/chart-model';
import { Chart } from '@frozik/charts/react/Chart';

import { ExpandableFrame } from '../../../../shared/ui/ExpandableFrame';

/** A chart of the demo in a frame that stretches it over the whole screen and back: the way to read one chart on a phone. */
export function ExpandableChart<TX>({
  model,
  className,
}: {
  readonly model: ChartModel<TX>;
  readonly className?: string;
}) {
  return (
    <ExpandableFrame className={className}>
      <Chart model={model} className="min-h-0 w-full flex-1" aria-label={model.id} />
    </ExpandableFrame>
  );
}
