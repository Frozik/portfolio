import { cn } from '@frozik/components/components/cn';
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';

interface RadioOption<TValue extends string> {
  readonly label: string;
  readonly value: TValue;
}

/**
 * Generic in the option value so the change handler receives the caller's
 * union or enum, not `string`. Not memoised: `memo` erases the type parameter.
 */
export const RadioGroup = <TValue extends string>({
  options,
  value,
  onChange,
  optionType = 'default',
  className,
}: {
  readonly options: readonly RadioOption<TValue>[];
  readonly value: TValue;
  readonly onChange: (value: TValue) => void;
  readonly optionType?: 'default' | 'button';
  readonly className?: string;
}) => {
  const handleValueChange = (next: string): void => {
    const option = options.find(candidate => candidate.value === next);
    if (option !== undefined) {
      onChange(option.value);
    }
  };

  if (optionType === 'button') {
    return (
      <RadioGroupPrimitive.Root
        value={value}
        onValueChange={handleValueChange}
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
      onValueChange={handleValueChange}
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
};
