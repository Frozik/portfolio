import { NumericEditor } from '@frozik/components';
import { memo, useState } from 'react';

import { RangeSlider, Slider } from '../../../../shared/ui';

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
        <h2 className="text-2xl font-semibold tracking-tight text-text">Rate / Amount / Number</h2>
        <p className="text-sm leading-relaxed text-text-secondary">
          Numeric input control with configurable decimal precision and PIP highlighting. Useful for
          conversion rates and financial inputs.{' '}
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
          suffixes are supported.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated/50 p-6">
        <NumericEditor
          decimal={decimals}
          pipStart={pipStart}
          pipSize={pipSize}
          allowNegative
          placeholder="Enter conversion rate"
        />
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <span className="mb-4 block text-sm font-medium text-text">PIP start + size</span>
          <RangeSlider min={-2} max={6} step={1} value={value} onChange={setValue} showTooltip />
        </div>

        <div className="space-y-3">
          <span className="mb-4 block text-sm font-medium text-text">Decimals</span>
          <Slider min={0} max={10} step={1} value={decimals} onChange={setDecimals} showTooltip />
        </div>
      </div>
    </section>
  );
});
