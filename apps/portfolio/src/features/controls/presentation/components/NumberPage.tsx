import { NumericEditor } from '@frozik/components/components/RichEditor/NumericEditor';
import { memo, useState } from 'react';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { CardFrame } from '../../../../shared/ui/CardFrame';
import { MonoKicker } from '../../../../shared/ui/MonoKicker';
import { SectionNumber } from '../../../../shared/ui/SectionNumber';
import { RangeSlider, Slider } from '../../../../shared/ui/Slider';
import { controlsT } from '../translations';
import { Kbd } from './Kbd';

export const NumberPage = memo(() => {
  const [value, setValue] = useState([2, 4]);
  const [decimals, setDecimals] = useState(6);

  const [pipStart, pipSize] =
    value[0] === value[1]
      ? [undefined, undefined]
      : [Math.min(value[0], value[1]), Math.max(value[0], value[1]) - Math.min(value[0], value[1])];

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
          decimal={decimals}
          pipStart={pipStart}
          pipSize={pipSize}
          allowNegative
          placeholder={controlsT.numberPage.placeholder}
          language={getCurrentLanguage()}
        />
      </CardFrame>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <MonoKicker tone="faint">{controlsT.numberPage.pipStartSize}</MonoKicker>
          <RangeSlider min={-2} max={6} step={1} value={value} onChange={setValue} showTooltip />
        </div>

        <div className="flex flex-col gap-3">
          <MonoKicker tone="faint">{controlsT.numberPage.decimals}</MonoKicker>
          <Slider min={0} max={10} step={1} value={decimals} onChange={setDecimals} showTooltip />
        </div>
      </div>
    </section>
  );
});
