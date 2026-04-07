import * as SliderPrimitive from '@radix-ui/react-slider';
import { memo, useMemo } from 'react';
import { cn } from '../lib/cn';

type SliderProps = {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  vertical?: boolean;
  className?: string;
};

export const Slider = memo(
  ({
    min,
    max,
    step = 1,
    value,
    onChange,
    disabled = false,
    vertical = false,
    className,
  }: SliderProps) => {
    const sliderValue = useMemo(() => [value], [value]);

    return (
      <SliderPrimitive.Root
        min={min}
        max={max}
        step={step}
        value={sliderValue}
        onValueChange={values => onChange(values[0])}
        disabled={disabled}
        orientation={vertical ? 'vertical' : 'horizontal'}
        className={cn(
          'relative flex touch-none select-none',
          vertical ? 'h-full flex-col items-center' : 'w-full items-center',
          disabled && 'opacity-50',
          className
        )}
      >
        <SliderPrimitive.Track
          className={cn(
            'relative grow rounded-full bg-surface-overlay',
            vertical ? 'w-1.5' : 'h-1.5 w-full'
          )}
        >
          <SliderPrimitive.Range
            className={cn('absolute rounded-full bg-brand-500', vertical ? 'w-full' : 'h-full')}
          />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={cn(
            'block h-4 w-4 rounded-full border-2 border-brand-500 bg-surface shadow',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            'transition-colors hover:bg-surface-elevated',
            disabled && 'cursor-not-allowed'
          )}
        />
      </SliderPrimitive.Root>
    );
  }
);

type RangeSliderProps = {
  min: number;
  max: number;
  step?: number;
  value: number[];
  onChange: (value: number[]) => void;
  disabled?: boolean;
  className?: string;
};

export const RangeSlider = memo(
  ({ min, max, step = 1, value, onChange, disabled = false, className }: RangeSliderProps) => (
    <SliderPrimitive.Root
      min={min}
      max={max}
      step={step}
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      className={cn(
        'relative flex w-full touch-none select-none items-center',
        disabled && 'opacity-50',
        className
      )}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow rounded-full bg-surface-overlay">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-brand-500" />
      </SliderPrimitive.Track>
      {value.map(v => (
        <SliderPrimitive.Thumb
          key={v}
          className={cn(
            'block h-4 w-4 rounded-full border-2 border-brand-500 bg-surface shadow',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            'transition-colors hover:bg-surface-elevated',
            disabled && 'cursor-not-allowed'
          )}
        />
      ))}
    </SliderPrimitive.Root>
  )
);

export type { RangeSliderProps, SliderProps };
