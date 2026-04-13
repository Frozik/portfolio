import { NumericEditor } from '@frozik/components';
import { memo, useState } from 'react';

import { RangeSlider, Slider } from '../../../../shared/ui';
import { controlsT } from '../translations';

export const NumberPage = memo(() => {
  const [value, setValue] = useState([2, 4]);
  const [decimals, setDecimals] = useState(6);

  const [pipStart, pipSize] =
    value[0] === value[1]
      ? [undefined, undefined]
      : [Math.min(value[0], value[1]), Math.max(value[0], value[1]) - Math.min(value[0], value[1])];

  return (
    <section className="mx-auto max-w-2xl space-y-8 px-6 py-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-text">
          {controlsT.numberPage.title}
        </h2>
        <p className="text-sm leading-relaxed text-text-secondary">
          {controlsT.numberPage.description}{' '}
          <kbd className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs text-text">
            K
          </kbd>
          ,{' '}
          <kbd className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs text-text">
            M
          </kbd>
          ,{' '}
          <kbd className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-xs text-text">
            B
          </kbd>{' '}
          {controlsT.numberPage.suffixHint}
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated/50 p-6">
        <NumericEditor
          decimal={decimals}
          pipStart={pipStart}
          pipSize={pipSize}
          allowNegative
          placeholder={controlsT.numberPage.placeholder}
        />
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <span className="mb-4 block text-sm font-medium text-text">
            {controlsT.numberPage.pipStartSize}
          </span>
          <RangeSlider min={-2} max={6} step={1} value={value} onChange={setValue} showTooltip />
        </div>

        <div className="space-y-3">
          <span className="mb-4 block text-sm font-medium text-text">
            {controlsT.numberPage.decimals}
          </span>
          <Slider min={0} max={10} step={1} value={decimals} onChange={setDecimals} showTooltip />
        </div>
      </div>
    </section>
  );
});
