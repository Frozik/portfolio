import { NumericEditor } from '@frozik/components/components/RichEditor/NumericEditor';
import { sortBy } from 'lodash-es';
import { memo, useState } from 'react';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { CardFrame } from '../../../../shared/ui/CardFrame';
import { MonoKicker } from '../../../../shared/ui/MonoKicker';
import { SectionNumber } from '../../../../shared/ui/SectionNumber';
import { RangeSlider, Slider } from '../../../../shared/ui/Slider';
import { controlsT } from '../translations';
import { Kbd } from './Kbd';

const PIP_RANGE_MIN = -2;
const PIP_RANGE_MAX = 6;
const PIP_RANGE_STEP = 1;
const DECIMALS_MIN = 0;
const DECIMALS_MAX = 10;
const DECIMALS_STEP = 1;

export const NumberPage = memo(() => {
  const [range, setRange] = useState<readonly [number, number]>([2, 4]);
  const [decimals, setDecimals] = useState(6);
  const [numericValue, setNumericValue] = useState<number | undefined>(undefined);

  const [rangeStart, rangeEnd] = sortBy(range);
  const hasPipRange = rangeStart !== rangeEnd;
  const pipStart = hasPipRange ? rangeStart : undefined;
  const pipSize = hasPipRange ? rangeEnd - rangeStart : undefined;

  return (
    <section className="flex flex-col gap-5">
      <SectionNumber number="02" label={controlsT.numberPage.sectionKicker} />
      <h2 className="text-[24px] font-medium text-landing-fg">{controlsT.numberPage.title}</h2>
      <p className="text-[14px] leading-[1.55] text-landing-fg-dim">
        {controlsT.numberPage.description} <Kbd>K</Kbd> <Kbd>M</Kbd> <Kbd>B</Kbd>{' '}
        {controlsT.numberPage.suffixHint}
      </p>

      <CardFrame className="p-6">
        <NumericEditor
          value={numericValue}
          onValueChange={setNumericValue}
          decimal={decimals}
          pipStart={pipStart}
          pipSize={pipSize}
          allowNegative
          placeholder={controlsT.numberPage.placeholder}
          locale={getCurrentLanguage()}
        />
      </CardFrame>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <MonoKicker tone="faint">{controlsT.numberPage.pipStartSize}</MonoKicker>
          <RangeSlider
            min={PIP_RANGE_MIN}
            max={PIP_RANGE_MAX}
            step={PIP_RANGE_STEP}
            value={range}
            onChange={setRange}
            showTooltip
          />
        </div>

        <div className="flex flex-col gap-3">
          <MonoKicker tone="faint">{controlsT.numberPage.decimals}</MonoKicker>
          <Slider
            min={DECIMALS_MIN}
            max={DECIMALS_MAX}
            step={DECIMALS_STEP}
            value={decimals}
            onChange={setDecimals}
            showTooltip
          />
        </div>
      </div>
    </section>
  );
});
