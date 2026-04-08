import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { memo } from 'react';
import { cn } from '../lib/cn';

type RadioOption = {
  label: string;
  value: string;
};

type RadioGroupProps = {
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  optionType?: 'default' | 'button';
  className?: string;
};

export const RadioGroup = memo(
  ({ options, value, onChange, optionType = 'default', className }: RadioGroupProps) => {
    if (optionType === 'button') {
      return (
        <RadioGroupPrimitive.Root
          value={value}
          onValueChange={onChange}
          className={cn('inline-flex rounded-lg border border-border overflow-hidden', className)}
        >
          {options.map(option => (
            <RadioGroupPrimitive.Item
              key={option.value}
              value={option.value}
              className={cn(
                'px-4 py-2 text-sm font-medium text-text-secondary transition-colors',
                'border-r border-border last:border-r-0',
                'hover:bg-surface-overlay',
                'data-[state=checked]:bg-brand-500 data-[state=checked]:text-white'
              )}
            >
              {option.label}
            </RadioGroupPrimitive.Item>
          ))}
        </RadioGroupPrimitive.Root>
      );
    }

    return (
      <RadioGroupPrimitive.Root
        value={value}
        onValueChange={onChange}
        className={cn('flex flex-col gap-2', className)}
      >
        {options.map(option => (
          <label
            key={option.value}
            htmlFor={`radio-${option.value}`}
            className="flex items-center gap-2 cursor-pointer"
          >
            <RadioGroupPrimitive.Item
              id={`radio-${option.value}`}
              value={option.value}
              className={cn(
                'h-4 w-4 rounded-full border border-border bg-surface',
                'data-[state=checked]:border-brand-500'
              )}
            >
              <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
                <span className="block h-2 w-2 rounded-full bg-brand-500" />
              </RadioGroupPrimitive.Indicator>
            </RadioGroupPrimitive.Item>
            <span className="text-sm text-text">{option.label}</span>
          </label>
        ))}
      </RadioGroupPrimitive.Root>
    );
  }
);

export type { RadioGroupProps, RadioOption };
