import { NumericEditor } from '@frozik/components';
import { memo, useState } from 'react';

import { RangeSlider, Slider } from '../../../../shared/ui';
import styles from './styles.module.scss';

export const NumberPage = memo(() => {
  const [value, setValue] = useState([2, 4]);
  const [decimals, setDecimals] = useState(6);

  const [pipStart, pipSize] =
    value[0] === value[1]
      ? [undefined, undefined]
      : [Math.min(value[0], value[1]), Math.max(value[0], value[1]) - Math.min(value[0], value[1])];

  return (
    <div className={styles.page}>
      <h3>Rate/Amount/Number Control</h3>
      <NumericEditor
        decimal={decimals}
        pipStart={pipStart}
        pipSize={pipSize}
        allowNegative
        placeholder="Enter conversion rate"
      />
      <div className={styles.controls}>
        <p>
          Numeric input control. It provides the ability to specify the number of significant digits
          in fraction part and PIP highlighting. This is particularly useful for controls used in
          the input and display of conversion rates. <strong>K</strong>, <strong>M</strong>,{' '}
          <strong>B</strong> suffixes are supported.
        </p>
        <h4>PIP start + size</h4>
        <RangeSlider min={-2} max={6} step={1} value={value} onChange={setValue} />
        <h4>Decimals</h4>
        <Slider min={0} max={10} step={1} value={decimals} onChange={setDecimals} />
      </div>
    </div>
  );
});
