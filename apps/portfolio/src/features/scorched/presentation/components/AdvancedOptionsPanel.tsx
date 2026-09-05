import { useFunction } from '@frozik/components/hooks/useFunction';
import type { ChangeEvent, ReactNode } from 'react';
import { memo } from 'react';

import { Slider } from '../../../../shared/ui/Slider';
import { Tooltip } from '../../../../shared/ui/Tooltip';
import type {
  ScorchedAdvancedOptions,
  ScorchedSetupOptions,
} from '../../application/scorched-setup';
import {
  MAX_ARMS_LEVEL,
  MAX_GRAVITY,
  MAX_INTEREST_PERCENT,
  MAX_TALK_PROBABILITY_PERCENT,
  MAX_VISCOSITY,
  MIN_ARMS_LEVEL,
  MIN_GRAVITY,
  MIN_INTEREST_PERCENT,
  MIN_TALK_PROBABILITY_PERCENT,
  MIN_VISCOSITY,
} from '../../domain/constants';
import type { WallMode } from '../../domain/types';
import { scorchedT } from '../translations';

const GRAVITY_STEP = 0.05;
const WHOLE_STEP = 1;
const PERCENT_STEP = 5;

/** [MANUAL §5] Every wall behaviour the domain knows, in the manual's own order. */
const WALL_MODES: readonly WallMode[] = [
  'none',
  'concrete',
  'padded',
  'rubber',
  'spring',
  'wrap',
  'random',
  'erratic',
];

/** The select's stand-in for "no override": the curated Walls row keeps deciding. */
const WALL_MODE_FROM_PRESET_VALUE = '';

function toWallMode(value: string): WallMode | undefined {
  return WALL_MODES.find(candidate => candidate === value);
}

const rowClass = 'flex flex-col gap-1.5';
const labelClass = 'flex items-baseline justify-between text-xs text-text-secondary';
const valueClass = 'font-mono tabular-nums text-text';
const selectClass = 'rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-text';
const checkboxRowClass = 'flex items-center gap-2 text-xs text-text-secondary';

/** Every knob carries its own one-line explanation; none of them is self-evident. */
const HintedLabel = memo(
  ({ hint, children }: { readonly hint: string; readonly children: ReactNode }) => (
    <Tooltip title={hint}>
      <span className="cursor-help underline decoration-dotted underline-offset-4">{children}</span>
    </Tooltip>
  )
);

const SliderRow = memo(
  ({
    label,
    hint,
    value,
    min,
    max,
    step,
    onChange,
  }: {
    readonly label: string;
    readonly hint: string;
    readonly value: number;
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly onChange: (value: number) => void;
  }) => (
    <div className={rowClass}>
      <span className={labelClass}>
        <HintedLabel hint={hint}>{label}</HintedLabel>
        <span className={valueClass}>{value}</span>
      </span>
      <Slider value={value} min={min} max={max} step={step} onChange={onChange} />
    </div>
  )
);

const ToggleRow = memo(
  ({
    label,
    hint,
    isChecked,
    onChange,
  }: {
    readonly label: string;
    readonly hint: string;
    readonly isChecked: boolean;
    readonly onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  }) => (
    <label className={checkboxRowClass}>
      <input
        type="checkbox"
        checked={isChecked}
        onChange={onChange}
        className="size-4 accent-brand-500"
      />
      <HintedLabel hint={hint}>{label}</HintedLabel>
    </label>
  )
);

/**
 * The one collapsed Advanced panel: every purist knob the curated row deliberately hides,
 * grouped in a single place and opening at the manual's own defaults.
 */
export const AdvancedOptionsPanel = memo(
  ({
    setup,
    onChange,
  }: {
    readonly setup: ScorchedSetupOptions;
    readonly onChange: (setup: ScorchedSetupOptions) => void;
  }) => {
    const { advanced } = setup;

    const patch = useFunction((changes: Partial<ScorchedAdvancedOptions>) => {
      onChange({ ...setup, advanced: { ...advanced, ...changes } });
    });

    const handleGravity = useFunction((gravity: number) => patch({ gravity }));
    const handleViscosity = useFunction((viscosity: number) => patch({ viscosity }));
    const handleTalk = useFunction((talkProbabilityPercent: number) =>
      patch({ talkProbabilityPercent })
    );
    const handleArmsLevel = useFunction((armsLevel: number) => patch({ armsLevel }));
    const handleInterest = useFunction((interestPercent: number) => patch({ interestPercent }));

    const handleBorders = useFunction((event: ChangeEvent<HTMLInputElement>) => {
      patch({ isBordersExtendEnabled: event.target.checked });
    });

    const handleTunneling = useFunction((event: ChangeEvent<HTMLInputElement>) => {
      patch({ isTunnelingEnabled: event.target.checked });
    });

    const handleTankFalls = useFunction((event: ChangeEvent<HTMLInputElement>) => {
      patch({ areTankFallsEnabled: event.target.checked });
    });

    const handlePlayOrder = useFunction((event: ChangeEvent<HTMLSelectElement>) => {
      patch({ playOrder: event.target.value === 'random' ? 'random' : 'sequential' });
    });

    const handleWallMode = useFunction((event: ChangeEvent<HTMLSelectElement>) => {
      patch({ wallMode: toWallMode(event.target.value) });
    });

    return (
      <div className="grid grid-cols-1 gap-4 border-t border-white/10 px-4 py-4 sm:grid-cols-2">
        <p className="col-span-full text-xs text-text-muted">{scorchedT.roster.advancedHint}</p>

        <SliderRow
          label={scorchedT.options.gravity}
          hint={scorchedT.optionHints.gravity}
          value={advanced.gravity}
          min={MIN_GRAVITY}
          max={MAX_GRAVITY}
          step={GRAVITY_STEP}
          onChange={handleGravity}
        />
        <SliderRow
          label={scorchedT.options.viscosity}
          hint={scorchedT.optionHints.viscosity}
          value={advanced.viscosity}
          min={MIN_VISCOSITY}
          max={MAX_VISCOSITY}
          step={WHOLE_STEP}
          onChange={handleViscosity}
        />
        <SliderRow
          label={scorchedT.options.talkProbability}
          hint={scorchedT.optionHints.talkProbability}
          value={advanced.talkProbabilityPercent}
          min={MIN_TALK_PROBABILITY_PERCENT}
          max={MAX_TALK_PROBABILITY_PERCENT}
          step={PERCENT_STEP}
          onChange={handleTalk}
        />
        <SliderRow
          label={scorchedT.options.armsLevel}
          hint={scorchedT.optionHints.armsLevel}
          value={advanced.armsLevel}
          min={MIN_ARMS_LEVEL}
          max={MAX_ARMS_LEVEL}
          step={WHOLE_STEP}
          onChange={handleArmsLevel}
        />
        <SliderRow
          label={scorchedT.options.interest}
          hint={scorchedT.optionHints.interest}
          value={advanced.interestPercent}
          min={MIN_INTEREST_PERCENT}
          max={MAX_INTEREST_PERCENT}
          step={WHOLE_STEP}
          onChange={handleInterest}
        />

        <label className={rowClass}>
          <HintedLabel hint={scorchedT.optionHints.playOrder}>
            <span className="text-xs text-text-secondary">{scorchedT.options.playOrder}</span>
          </HintedLabel>
          <select value={advanced.playOrder} onChange={handlePlayOrder} className={selectClass}>
            <option value="sequential">{scorchedT.options.playOrderSequential}</option>
            <option value="random">{scorchedT.options.playOrderRandom}</option>
          </select>
        </label>

        <label className={rowClass}>
          <HintedLabel hint={scorchedT.optionHints.wallMode}>
            <span className="text-xs text-text-secondary">{scorchedT.options.wallMode}</span>
          </HintedLabel>
          <select
            value={advanced.wallMode ?? WALL_MODE_FROM_PRESET_VALUE}
            onChange={handleWallMode}
            className={selectClass}
          >
            <option value={WALL_MODE_FROM_PRESET_VALUE}>
              {scorchedT.options.wallModeFromPreset}
            </option>
            {WALL_MODES.map(wallMode => (
              <option key={wallMode} value={wallMode}>
                {scorchedT.wallModes[wallMode]}
              </option>
            ))}
          </select>
        </label>

        <ToggleRow
          label={scorchedT.options.bordersExtend}
          hint={scorchedT.optionHints.bordersExtend}
          isChecked={advanced.isBordersExtendEnabled}
          onChange={handleBorders}
        />
        <ToggleRow
          label={scorchedT.options.tunneling}
          hint={scorchedT.optionHints.tunneling}
          isChecked={advanced.isTunnelingEnabled}
          onChange={handleTunneling}
        />
        <ToggleRow
          label={scorchedT.options.tankFalls}
          hint={scorchedT.optionHints.tankFalls}
          isChecked={advanced.areTankFallsEnabled}
          onChange={handleTankFalls}
        />
      </div>
    );
  }
);
