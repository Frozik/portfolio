import { cn } from '@frozik/components/components/cn';
import { isNil } from 'lodash-es';
import { Check, ChevronDown } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { Dropdown, DropdownItem } from '../../../../shared/ui/Dropdown';
import { formatMeters } from '../../application/render/plan-draw/shared';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { WallElevation } from '../../domain/geometry/wall-elevation';
import { buildWallElevation } from '../../domain/geometry/wall-elevation';
import { devicesOf } from '../../domain/model/storeys';
import type { WallId } from '../../domain/model/walls';
import { METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PlannerPanel } from './PlannerPanel';
import { PropertyRow } from './PropertyRow';

const GLYPH_SIZE_PX = 12;
/** The sheet is drawn in centimetres so the text sizes read at any wall length. */
const UNITS_PER_METER = 100;
const MARGIN = 40;
const DEVICE_RADIUS = 8;
const CAPTION_SIZE = 11;
const RUN_DASH = '4 3';

const WallItem = memo(
  ({
    wallId,
    ordinal,
    isSelected,
    onSelect,
  }: {
    readonly wallId: WallId;
    readonly ordinal: number;
    readonly isSelected: boolean;
    readonly onSelect: (wallId: WallId) => void;
  }) => {
    const handleSelect = useEventCallback(() => onSelect(wallId));

    return (
      <DropdownItem
        onSelect={handleSelect}
        className={cn('gap-2 py-1.5 text-xs', isSelected && 'text-brand-500')}
      >
        <Check
          size={GLYPH_SIZE_PX}
          className={cn('shrink-0', !isSelected && 'invisible')}
          aria-hidden
        />
        {`${sitePlannerT.walls.wallTitle} ${ordinal}`}
      </DropdownItem>
    );
  }
);

/**
 * The wall unfolded: openings as holes, devices as lettered discs at their
 * heights, the ceiling run dashed with a drop to every device, the length
 * and the height captioned — what the electrician marks the wall from.
 */
const ElevationSheet = memo(({ elevation }: { readonly elevation: WallElevation }) => {
  const width = elevation.lengthMeters * UNITS_PER_METER;
  const height = elevation.heightMeters * UNITS_PER_METER;
  const toY = (meters: number): number => MARGIN + height - meters * UNITS_PER_METER;
  const toX = (meters: number): number => MARGIN + meters * UNITS_PER_METER;
  const { meterUnit } = sitePlannerT.plan;
  const runY = toY(elevation.runHeightMeters);

  return (
    <svg
      viewBox={`0 0 ${width + MARGIN * 2} ${height + MARGIN * 2}`}
      className="w-full"
      role="img"
      aria-label={sitePlannerT.wiring.elevationPanelTitle}
    >
      <rect
        x={MARGIN}
        y={MARGIN}
        width={width}
        height={height}
        className="fill-white/10 stroke-white/40"
      />
      {elevation.openings.map(opening => (
        <rect
          key={opening.id}
          x={toX(opening.fromMeters)}
          y={toY(opening.headMeters)}
          width={opening.widthMeters * UNITS_PER_METER}
          height={(opening.headMeters - opening.sillMeters) * UNITS_PER_METER}
          className={cn(
            'stroke-white/60',
            opening.kind === 'door' ? 'fill-surface-elevated' : 'fill-sky-500/20'
          )}
        />
      ))}
      {elevation.devices.length > 0 ? (
        <line
          x1={MARGIN}
          x2={MARGIN + width}
          y1={runY}
          y2={runY}
          strokeDasharray={RUN_DASH}
          className="stroke-amber-500"
        />
      ) : undefined}
      {elevation.devices.map(device => {
        const x = toX(device.alongMeters);
        const y = toY(device.heightMeters);

        return (
          <g key={device.id}>
            <line x1={x} x2={x} y1={runY} y2={y} className="stroke-amber-500" />
            <circle
              cx={x}
              cy={y}
              r={DEVICE_RADIUS}
              className="fill-amber-500/30 stroke-amber-500"
            />
            <text x={x} y={y + 3} textAnchor="middle" className="fill-white font-mono text-[9px]">
              {sitePlannerT.wiring.deviceLetters[device.kind]}
            </text>
            <text
              x={x + DEVICE_RADIUS + 3}
              y={y + 3}
              className="fill-text-secondary font-mono"
              fontSize={CAPTION_SIZE}
            >
              {formatMeters(device.heightMeters, meterUnit, METER_DECIMALS)}
            </text>
          </g>
        );
      })}
      <text
        x={MARGIN + width / 2}
        y={MARGIN + height + MARGIN / 2 + 4}
        textAnchor="middle"
        className="fill-text-secondary font-mono"
        fontSize={CAPTION_SIZE}
      >
        {formatMeters(elevation.lengthMeters, meterUnit, METER_DECIMALS)}
      </text>
      <text
        x={MARGIN / 2}
        y={MARGIN + height / 2}
        textAnchor="middle"
        transform={`rotate(-90 ${MARGIN / 2} ${MARGIN + height / 2})`}
        className="fill-text-secondary font-mono"
        fontSize={CAPTION_SIZE}
      >
        {formatMeters(elevation.heightMeters, meterUnit, METER_DECIMALS)}
      </text>
    </svg>
  );
});

/**
 * One wall of the active storey unfolded (`wiring.md` §3.6): pick the wall,
 * or let the selected device pick its own. Read straight off the plan, so
 * moving a socket on the plan moves it on the sheet.
 */
export const WallElevationPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const scene = store.storeys.editedStoreyScene;
  const labels = sitePlannerT.wiring;
  const [chosenWallId, setChosenWallId] = useState<WallId | undefined>(undefined);
  const handleChoose = useEventCallback((wallId: WallId) => setChosenWallId(wallId));

  if (isNil(scene)) {
    return null;
  }

  const { storey } = scene;
  const hostWallId =
    store.electrics.selectedDevice?.host.kind === 'wall'
      ? store.electrics.selectedDevice.host.wallId
      : undefined;
  const wallId =
    hostWallId ??
    (storey.walls.some(wall => wall.id === chosenWallId) ? chosenWallId : storey.walls[0]?.id);
  const wall = storey.walls.find(candidate => candidate.id === wallId);
  const ordinal = storey.walls.findIndex(candidate => candidate.id === wallId) + 1;

  return (
    <PlannerPanel title={labels.elevationPanelTitle}>
      {isNil(wall) ? (
        <PanelHint>{labels.elevationEmptyHint}</PanelHint>
      ) : (
        <>
          <PropertyRow label={labels.elevationWallLabel} isControlStretched>
            <Dropdown
              trigger={
                <button
                  type="button"
                  className={cn(
                    'flex min-w-0 items-center gap-1 rounded-md border border-white/10 px-2 py-1',
                    'text-[11px] text-text transition-colors duration-150 hover:bg-white/10',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
                  )}
                >
                  <span className="truncate">{`${sitePlannerT.walls.wallTitle} ${ordinal}`}</span>
                  <ChevronDown
                    size={GLYPH_SIZE_PX}
                    className="shrink-0 text-text-secondary"
                    aria-hidden
                  />
                </button>
              }
            >
              {storey.walls.map((candidate, index) => (
                <WallItem
                  key={candidate.id}
                  wallId={candidate.id}
                  ordinal={index + 1}
                  isSelected={candidate.id === wall.id}
                  onSelect={handleChoose}
                />
              ))}
            </Dropdown>
          </PropertyRow>
          <ElevationSheet
            elevation={buildWallElevation({
              wall,
              openings: storey.openings,
              devices: devicesOf(storey),
              storeyHeightMeters: storey.heightMeters,
            })}
          />
        </>
      )}
    </PlannerPanel>
  );
});
