import { useFunction } from '@frozik/components/hooks/useFunction';
import * as SliderPrimitive from '@radix-ui/react-slider';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { memo, useMemo, useState } from 'react';
import { cn } from '../lib/cn';

const TOOLTIP_SIDE_OFFSET = 4;
const TOOLTIP_DELAY_DURATION = 0;

type TooltipSide = 'top' | 'right';

type SliderThumbWithTooltipProps = {
  disabled: boolean;
  showTooltip: boolean;
  formatTooltip: (value: number) => ReactNode;
  tooltipSide: TooltipSide;
  value: number;
};

const SliderThumbWithTooltip = memo(
  ({ disabled, showTooltip, formatTooltip, tooltipSide, value }: SliderThumbWithTooltipProps) => {
    const [isHovering, setIsHovering] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const handleMouseEnter = useFunction(() => {
      setIsHovering(true);
    });

    const handleMouseLeave = useFunction(() => {
      setIsHovering(false);
    });

    const handlePointerDown = useFunction(() => {
      setIsDragging(true);

      const handlePointerUp = () => {
        setIsDragging(false);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointerup', handlePointerUp);
    });

    const thumbElement = (
      <SliderPrimitive.Thumb
        className={cn(
          'block h-4 w-4 rounded-full border-2 border-brand-500 bg-surface shadow',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          'transition-colors hover:bg-surface-elevated',
          disabled && 'cursor-not-allowed'
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onPointerDown={handlePointerDown}
      />
    );

    if (!showTooltip) {
      return thumbElement;
    }

    const isOpen = isHovering || isDragging;

    return (
      <TooltipPrimitive.Provider delayDuration={TOOLTIP_DELAY_DURATION}>
        <TooltipPrimitive.Root open={isOpen}>
          <TooltipPrimitive.Trigger asChild>{thumbElement}</TooltipPrimitive.Trigger>
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              side={tooltipSide}
              sideOffset={TOOLTIP_SIDE_OFFSET}
              className={cn(
                'z-50 rounded-md bg-surface-overlay px-3 py-1.5 text-sm text-text shadow-md',
                'animate-in fade-in-0 zoom-in-95'
              )}
            >
              {formatTooltip(value)}
              <TooltipPrimitive.Arrow className="fill-surface-overlay" />
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      </TooltipPrimitive.Provider>
    );
  }
);

type SliderProps = {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  vertical?: boolean;
  className?: string;
  showTooltip?: boolean;
  formatTooltip?: (value: number) => ReactNode;
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
    showTooltip = false,
    formatTooltip = String,
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
        <SliderThumbWithTooltip
          disabled={disabled}
          showTooltip={showTooltip}
          formatTooltip={formatTooltip}
          tooltipSide={vertical ? 'right' : 'top'}
          value={value}
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
  showTooltip?: boolean;
  formatTooltip?: (value: number) => ReactNode;
};

export const RangeSlider = memo(
  ({
    min,
    max,
    step = 1,
    value,
    onChange,
    disabled = false,
    className,
    showTooltip = false,
    formatTooltip = String,
  }: RangeSliderProps) => (
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
      {value.map((v, index) => (
        <SliderThumbWithTooltip
          // biome-ignore lint/suspicious/noArrayIndexKey: Radix Slider thumbs are positional — count and order are stable, and values can duplicate
          key={index}
          disabled={disabled}
          showTooltip={showTooltip}
          formatTooltip={formatTooltip}
          tooltipSide="top"
          value={v}
        />
      ))}
    </SliderPrimitive.Root>
  )
);

export type { RangeSliderProps, SliderProps };
