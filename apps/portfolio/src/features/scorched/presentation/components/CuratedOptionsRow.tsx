import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import type { ChangeEvent } from 'react';
import { memo } from 'react';

import type {
  ScorchedSetupOptions,
  WallsPreset,
  WindPreset,
} from '../../application/scorched-setup';
import { MAX_ROUND_COUNT, MIN_ROUND_COUNT } from '../../domain/constants';
import { GLASS_PANEL_CLASS } from '../constants';
import { formatCash } from '../hud-format';
import { scorchedT } from '../translations';

/** The curated row: rounds, wind, walls, starting cash. Everything else is Advanced. */
const ROUND_CHOICES: readonly number[] = [1, 3, 5, 10, 20].filter(
  count => count >= MIN_ROUND_COUNT && count <= MAX_ROUND_COUNT
);
const CASH_CHOICES: readonly number[] = [0, 10000, 50000, 200000];

interface SegmentChoice {
  readonly value: string;
  readonly label: string;
}

const WIND_PRESETS: readonly WindPreset[] = ['off', 'steady', 'changing'];
const WALLS_PRESETS: readonly WallsPreset[] = ['none', 'bouncy', 'wrap'];

const WIND_CHOICES: readonly SegmentChoice[] = [
  { value: 'off', label: scorchedT.options.windOff },
  { value: 'steady', label: scorchedT.options.windSteady },
  { value: 'changing', label: scorchedT.options.windChanging },
];

const WALLS_CHOICES: readonly SegmentChoice[] = [
  { value: 'none', label: scorchedT.options.wallsNone },
  { value: 'bouncy', label: scorchedT.options.wallsBouncy },
  { value: 'wrap', label: scorchedT.options.wallsWrap },
];

const selectClass =
  'rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-text ' +
  'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-brand-500';
const legendClass = 'text-[0.625rem] uppercase tracking-widest text-text-muted';

const SegmentButton = memo(
  ({
    choice,
    isActive,
    onSelect,
  }: {
    readonly choice: SegmentChoice;
    readonly isActive: boolean;
    readonly onSelect: (value: string) => void;
  }) => {
    const handleClick = useFunction(() => onSelect(choice.value));

    return (
      <button
        type="button"
        aria-pressed={isActive}
        onClick={handleClick}
        className={cn(
          'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors duration-150',
          isActive ? 'bg-brand-500 text-white' : 'text-text-secondary hover:bg-white/10'
        )}
      >
        {choice.label}
      </button>
    );
  }
);

const Segmented = memo(
  ({
    label,
    value,
    choices,
    onSelect,
  }: {
    readonly label: string;
    readonly value: string;
    readonly choices: readonly SegmentChoice[];
    readonly onSelect: (value: string) => void;
  }) => (
    <fieldset className="flex min-w-fit flex-1 flex-col gap-1.5">
      <legend className={legendClass}>{label}</legend>
      <div className="flex gap-1 rounded-lg border border-white/10 bg-black/30 p-1">
        {choices.map(choice => (
          <SegmentButton
            key={choice.value}
            choice={choice}
            isActive={choice.value === value}
            onSelect={onSelect}
          />
        ))}
      </div>
    </fieldset>
  )
);

export const CuratedOptionsRow = memo(
  ({
    setup,
    onChange,
  }: {
    readonly setup: ScorchedSetupOptions;
    readonly onChange: (setup: ScorchedSetupOptions) => void;
  }) => {
    const handleRoundsChange = useFunction((event: ChangeEvent<HTMLSelectElement>) => {
      onChange({ ...setup, roundCount: Number(event.target.value) });
    });

    const handleCashChange = useFunction((event: ChangeEvent<HTMLSelectElement>) => {
      onChange({ ...setup, startingCash: Number(event.target.value) });
    });

    const handleWindSelect = useFunction((value: string) => {
      const wind = WIND_PRESETS.find(candidate => candidate === value);

      if (!isNil(wind)) {
        onChange({ ...setup, wind });
      }
    });

    const handleWallsSelect = useFunction((value: string) => {
      const walls = WALLS_PRESETS.find(candidate => candidate === value);

      if (!isNil(walls)) {
        onChange({ ...setup, walls });
      }
    });

    return (
      <div className={cn(GLASS_PANEL_CLASS, 'flex flex-wrap gap-4')}>
        <label className="flex min-w-28 flex-1 flex-col gap-1.5">
          <span className={legendClass}>{scorchedT.options.rounds}</span>
          <select value={setup.roundCount} onChange={handleRoundsChange} className={selectClass}>
            {ROUND_CHOICES.map(count => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>

        <Segmented
          label={scorchedT.options.wind}
          value={setup.wind}
          choices={WIND_CHOICES}
          onSelect={handleWindSelect}
        />

        <Segmented
          label={scorchedT.options.walls}
          value={setup.walls}
          choices={WALLS_CHOICES}
          onSelect={handleWallsSelect}
        />

        <label className="flex min-w-32 flex-1 flex-col gap-1.5">
          <span className={legendClass}>{scorchedT.options.startingCash}</span>
          <select value={setup.startingCash} onChange={handleCashChange} className={selectClass}>
            {CASH_CHOICES.map(cash => (
              <option key={cash} value={cash}>
                {formatCash(cash)}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }
);
