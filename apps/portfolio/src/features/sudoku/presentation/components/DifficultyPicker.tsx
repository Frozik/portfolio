import { useFunction } from '@frozik/components';
import { memo } from 'react';
import { cn } from '../../../../shared/lib/cn';

export type SudokuDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface DifficultyOption {
  readonly value: SudokuDifficulty;
  readonly label: string;
  readonly level: 1 | 2 | 3 | 4;
}

interface DifficultyPickerProps {
  readonly options: readonly DifficultyOption[];
  readonly onSelect: (value: SudokuDifficulty) => void;
}

const TOTAL_METER_SEGMENTS = 4;

export const DifficultyPicker = memo(({ options, onSelect }: DifficultyPickerProps) => (
  <div className="grid grid-cols-2 gap-4 p-4 sm:gap-5">
    {options.map(option => (
      <DifficultyCard key={option.value} option={option} onSelect={onSelect} />
    ))}
  </div>
));

const DifficultyCard = memo(
  ({
    option,
    onSelect,
  }: {
    option: DifficultyOption;
    onSelect: (value: SudokuDifficulty) => void;
  }) => {
    const handleClick = useFunction(() => onSelect(option.value));

    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={option.label}
        className={cn(
          'group flex size-36 flex-col items-center justify-center gap-4 rounded-2xl sm:size-40',
          'bg-neutral-800 text-neutral-300 shadow-lg transition-all',
          'hover:scale-105 hover:bg-neutral-700 hover:text-white',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
          'active:scale-95'
        )}
      >
        <span className="text-sm font-semibold uppercase tracking-[0.15em]">{option.label}</span>
        <DifficultyMeter level={option.level} />
      </button>
    );
  }
);

const DifficultyMeter = memo(({ level }: { level: number }) => (
  <div className="flex items-center gap-1">
    {Array.from({ length: TOTAL_METER_SEGMENTS }, (_, index) => (
      <span
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative segments
        key={index}
        className={cn(
          'h-2.5 w-4 rounded-sm border border-current',
          index < level ? 'bg-current' : 'bg-transparent'
        )}
      />
    ))}
  </div>
));
