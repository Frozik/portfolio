import { observer } from 'mobx-react-lite';
import type { ChangeEvent, FormEvent } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { Button } from '../../../../shared/ui/Button';
import type { PlotModel } from '../../application/PlotModel';
import { transportT } from '../translations';

const INPUT_CLASS =
  'h-9 min-w-0 rounded-md border border-border bg-surface-elevated px-3 font-mono text-sm text-text ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';

export const PlotForm = observer(({ plot }: { readonly plot: PlotModel }) => {
  const handleSubmit = useEventCallback((event: FormEvent) => {
    event.preventDefault();
    plot.plot();
  });
  const handleExpression = useEventCallback((event: ChangeEvent<HTMLInputElement>) =>
    plot.setView({ expression: event.target.value })
  );
  const handleXMin = useEventCallback((event: ChangeEvent<HTMLInputElement>) =>
    plot.setView({ xMin: event.target.valueAsNumber })
  );
  const handleXMax = useEventCallback((event: ChangeEvent<HTMLInputElement>) =>
    plot.setView({ xMax: event.target.valueAsNumber })
  );

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <label className="flex items-center gap-3">
        <span className="shrink-0 font-mono text-sm text-landing-fg-dim">
          {transportT.plot.expression}
        </span>
        <input
          className={`${INPUT_CLASS} flex-1`}
          value={plot.view.expression}
          maxLength={plot.limits.expressionMaxLength}
          spellCheck={false}
          autoComplete="off"
          onChange={handleExpression}
        />
      </label>
      <p className="text-xs text-landing-fg-faint">{transportT.plot.expressionHint}</p>
      <div className="flex flex-wrap items-center gap-3 text-sm text-landing-fg-dim">
        <label className="flex items-center gap-2">
          {transportT.plot.xMin}
          <input
            type="number"
            className={`${INPUT_CLASS} w-24`}
            value={plot.view.xMin}
            onChange={handleXMin}
          />
        </label>
        <label className="flex items-center gap-2">
          {transportT.plot.xMax}
          <input
            type="number"
            className={`${INPUT_CLASS} w-24`}
            value={plot.view.xMax}
            onChange={handleXMax}
          />
        </label>
        <Button type="submit" className="ml-auto">
          {transportT.plot.submit}
        </Button>
      </div>
    </form>
  );
});
