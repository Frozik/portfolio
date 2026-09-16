import { cn } from '@frozik/components/components/cn';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type {
  PanelAssembly,
  PanelModule,
  PanelModuleKind,
} from '../../domain/model/panel-assembly';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PlannerPanel } from './PlannerPanel';

/** A DIN rail holds twelve modules per row in the stock enclosures. */
const MODULES_PER_ROW = 12;
const MODULE_WIDTH = 18;
const MODULE_HEIGHT = 30;
const RAIL_GAP = 6;
const LABEL_HEIGHT = 10;
const ROW_HEIGHT = MODULE_HEIGHT + LABEL_HEIGHT + RAIL_GAP;
const CORNER_RADIUS = 2;

const MODULE_FILL: Readonly<Record<PanelModuleKind, string>> = {
  incomer: 'fill-brand-500/70',
  breaker: 'fill-amber-500/50',
  rcbo: 'fill-sky-500/50',
};

/** Where each module sits: packed left to right, wrapping at the rail's end. */
function layoutModules(
  modules: readonly PanelModule[]
): readonly { readonly module: PanelModule; readonly row: number; readonly column: number }[] {
  const placed: { module: PanelModule; row: number; column: number }[] = [];
  let row = 0;
  let column = 0;

  for (const module of modules) {
    if (column + module.width > MODULES_PER_ROW) {
      row += 1;
      column = 0;
    }

    placed.push({ module, row, column });
    column += module.width;
  }

  return placed;
}

/** The rail drawn to scale: one box per device, the incomer first, designations under. */
const DinRail = memo(({ assembly }: { readonly assembly: PanelAssembly }) => {
  const rows = Math.ceil(assembly.enclosureModules / MODULES_PER_ROW);
  const width = MODULES_PER_ROW * MODULE_WIDTH;
  const height = rows * ROW_HEIGHT;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label={sitePlannerT.wiring.assemblyPanelTitle}
    >
      {Array.from({ length: rows }, (_, row) => (
        <rect
          key={row}
          x={0}
          y={row * ROW_HEIGHT + MODULE_HEIGHT / 2 - 1}
          width={width}
          height={2}
          className="fill-white/20"
        />
      ))}
      {layoutModules(assembly.modules).map(({ module, row, column }) => (
        <g key={module.designation}>
          <rect
            x={column * MODULE_WIDTH + 1}
            y={row * ROW_HEIGHT}
            width={module.width * MODULE_WIDTH - 2}
            height={MODULE_HEIGHT}
            rx={CORNER_RADIUS}
            className={cn('stroke-white/30', MODULE_FILL[module.kind])}
          />
          <text
            x={column * MODULE_WIDTH + (module.width * MODULE_WIDTH) / 2}
            y={row * ROW_HEIGHT + MODULE_HEIGHT / 2 + 3}
            textAnchor="middle"
            className="fill-white font-mono text-[8px]"
          >
            {module.amperes}
          </text>
          <text
            x={column * MODULE_WIDTH + (module.width * MODULE_WIDTH) / 2}
            y={row * ROW_HEIGHT + MODULE_HEIGHT + LABEL_HEIGHT - 2}
            textAnchor="middle"
            className="fill-text-secondary font-mono text-[7px]"
          >
            {module.designation}
          </text>
        </g>
      ))}
    </svg>
  );
});

/** One device of the rail as a line of the schedule: designation, rating, what it feeds. */
const ModuleRow = memo(({ module }: { readonly module: PanelModule }) => {
  const labels = sitePlannerT.wiring;
  const purpose = isNil(module.purpose) ? undefined : labels.purposes[module.purpose];
  const room = isNil(module.roomTypeId) ? undefined : sitePlannerT.rooms.types[module.roomTypeId];
  const caption = [purpose, room].filter(part => !isNil(part)).join(' · ');

  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-8 shrink-0 font-mono text-text-secondary">{module.designation}</span>
      <span className="w-10 shrink-0 font-mono text-text">{`${module.amperes} A`}</span>
      <span className="min-w-0 flex-1 truncate text-text">
        {labels.moduleKinds[module.kind]}
        {caption.length > 0 ? ` · ${caption}` : ''}
      </span>
    </div>
  );
});

/**
 * Every щиток of the active storey on its rail (`wiring.md` §3.6): the
 * incomer, a breaker per группа rated by its cable, an RCBO wherever a
 * consumer stands in a wet room, and the smallest stock box that holds them
 * with a fifth in reserve. Nothing here is drawn by hand — wire a group on
 * the plan and its breaker appears.
 */
export const PanelAssemblyPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const scene = store.storeys.editedStoreyScene;
  const labels = sitePlannerT.wiring;

  if (isNil(scene)) {
    return null;
  }

  const assemblies = scene.panelAssemblies.filter(assembly => assembly.modules.length > 1);

  return (
    <PlannerPanel title={labels.assemblyPanelTitle}>
      {assemblies.map((assembly, index) => (
        <div key={assembly.panelId} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-text">{labels.assemblyTitle(index + 1)}</span>
            <span className="font-mono text-text-secondary">
              {labels.enclosure(assembly.usedModules, assembly.enclosureModules)}
            </span>
          </div>
          <DinRail assembly={assembly} />
          {assembly.modules.map(module => (
            <ModuleRow key={module.designation} module={module} />
          ))}
        </div>
      ))}
      {assemblies.length === 0 ? <PanelHint>{labels.assemblyEmptyHint}</PanelHint> : undefined}
    </PlannerPanel>
  );
});
