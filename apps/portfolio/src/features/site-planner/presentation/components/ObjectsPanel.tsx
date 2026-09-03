import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import type { LucideIcon } from 'lucide-react';
import { Car, Route, Trash2, TreePine } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';
import { memo } from 'react';
import { formatMeters } from '../../application/render/plan-draw/shared';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { CarInstance, SitePath, TreeInstance } from '../../domain/model/site-plan';
import { uniformPathWidth } from '../../domain/model/site-plan';
import { DEGREE_DECIMALS, METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PlannerPanel } from './PlannerPanel';
import { ACTION_BUTTON_CLASS } from './StructureTermTree';

const ICON_SIZE_PX = 14;

const DEGREE_GLYPH = '°';

/**
 * A row of the placed objects: what it is on the left, the button that removes
 * it on the right. Trees and paths are listed rather than folded — they are
 * instances, not terms of a composition, so there is no operation to toggle and
 * no order to keep.
 */
const ObjectRow = memo(
  ({
    label,
    detail,
    isSelected,
    removeLabel,
    onSelect,
    onRemove,
  }: {
    readonly label: string;
    readonly detail: string;
    readonly isSelected: boolean;
    readonly removeLabel: string;
    readonly onSelect: VoidFunction;
    readonly onRemove: VoidFunction;
  }) => (
    <li
      className={cn(
        'flex items-center gap-0.5 rounded-lg px-1 py-0.5',
        isSelected ? 'bg-brand-500/20' : 'hover:bg-white/5'
      )}
    >
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={onSelect}
        className={cn(
          'flex min-w-0 flex-1 items-center justify-between gap-2 rounded px-1 py-1 text-left',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          isSelected ? 'text-text' : 'text-text-secondary'
        )}
      >
        <span className="truncate text-[11px]">{label}</span>
        <span className="shrink-0 font-mono text-[11px] text-text">{detail}</span>
      </button>

      <button
        type="button"
        aria-label={removeLabel}
        onClick={onRemove}
        className={ACTION_BUTTON_CLASS}
      >
        <Trash2 size={ICON_SIZE_PX} aria-hidden />
      </button>
    </li>
  )
);

/** Header and body of a list section; the count reads as the plot's inventory. */
const ObjectSection = memo(
  ({
    icon: Icon,
    title,
    count,
    emptyHint,
    children,
  }: {
    readonly icon: LucideIcon;
    readonly title: string;
    readonly count: number;
    readonly emptyHint: string;
    readonly children: ReactNode;
  }) => (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
        <span className="flex items-center gap-2 text-xs font-medium text-text-secondary">
          <Icon size={ICON_SIZE_PX} aria-hidden />
          {title}
        </span>
        <span className="font-mono text-[10px] text-text-muted">{count}</span>
      </div>

      {count === 0 ? (
        <PanelHint className="px-2 py-1">{emptyHint}</PanelHint>
      ) : (
        <ul className="flex flex-col">{children}</ul>
      )}
    </div>
  )
);

const TreeRow = observer(
  ({ store, tree }: { readonly store: SitePlannerStore; readonly tree: TreeInstance }) => {
    const { selection } = store;
    const isSelected =
      !isNil(selection) && selection.kind === 'tree' && selection.treeId === tree.id;

    const handleSelect = useFunction(() => store.setSelection({ kind: 'tree', treeId: tree.id }));
    const handleRemove = useFunction(() => store.siteObjects.removeTree(tree.id));

    return (
      <ObjectRow
        label={sitePlannerT.properties.species[tree.species]}
        detail={`${sitePlannerT.structure.radiusPrefix} ${formatMeters(tree.crownRadius, sitePlannerT.plan.meterUnit)}`}
        isSelected={isSelected}
        removeLabel={sitePlannerT.structure.removeTree}
        onSelect={handleSelect}
        onRemove={handleRemove}
      />
    );
  }
);

const CarRow = observer(
  ({ store, car }: { readonly store: SitePlannerStore; readonly car: CarInstance }) => {
    const { selection } = store;
    const isSelected = !isNil(selection) && selection.kind === 'car' && selection.carId === car.id;

    const handleSelect = useFunction(() => store.setSelection({ kind: 'car', carId: car.id }));
    const handleRemove = useFunction(() => store.siteObjects.removeCar(car.id));

    return (
      <ObjectRow
        label={sitePlannerT.properties.car}
        detail={`${car.rotationDegrees.toFixed(DEGREE_DECIMALS)}${DEGREE_GLYPH}`}
        isSelected={isSelected}
        removeLabel={sitePlannerT.structure.removeCar}
        onSelect={handleSelect}
        onRemove={handleRemove}
      />
    );
  }
);

const PathRow = observer(
  ({ store, path }: { readonly store: SitePlannerStore; readonly path: SitePath }) => {
    const { selection } = store;
    const isSelected =
      !isNil(selection) && selection.kind === 'path' && selection.pathId === path.id;

    const handleSelect = useFunction(() => store.setSelection({ kind: 'path', pathId: path.id }));
    const handleRemove = useFunction(() => store.siteObjects.removePath(path.id));

    return (
      <ObjectRow
        label={`${path.points.length} ${sitePlannerT.structure.pointCountSuffix}`}
        detail={formatPathWidth(path)}
        isSelected={isSelected}
        removeLabel={sitePlannerT.structure.removePath}
        onSelect={handleSelect}
        onRemove={handleRemove}
      />
    );
  }
);

const TreesSection = observer(({ store }: { readonly store: SitePlannerStore }) => (
  <ObjectSection
    icon={TreePine}
    title={sitePlannerT.structure.trees}
    count={store.trees.length}
    emptyHint={sitePlannerT.structure.emptyTrees}
  >
    {store.trees.map(tree => (
      <TreeRow key={tree.id} store={store} tree={tree} />
    ))}
  </ObjectSection>
));

const CarsSection = observer(({ store }: { readonly store: SitePlannerStore }) => (
  <ObjectSection
    icon={Car}
    title={sitePlannerT.structure.cars}
    count={store.cars.length}
    emptyHint={sitePlannerT.structure.emptyCars}
  >
    {store.cars.map(car => (
      <CarRow key={car.id} store={store} car={car} />
    ))}
  </ObjectSection>
));

const PathsSection = observer(({ store }: { readonly store: SitePlannerStore }) => (
  <ObjectSection
    icon={Route}
    title={sitePlannerT.structure.paths}
    count={store.paths.length}
    emptyHint={sitePlannerT.structure.emptyPaths}
  >
    {store.paths.map(path => (
      <PathRow key={path.id} store={store} path={path} />
    ))}
  </ObjectSection>
));

/**
 * View mode's inventory: the objects standing on the plot as flat lists. The
 * plot's own anatomy is behind «Редактировать участок» — this card is for what
 * is placed, not for what is drawn.
 */
export const ObjectsPanel = observer(({ store }: { readonly store: SitePlannerStore }) => (
  <PlannerPanel title={sitePlannerT.objects.title}>
    <TreesSection store={store} />
    <CarsSection store={store} />
    <PathsSection store={store} />
  </PlannerPanel>
));

/** One width reads as that width; a varying ribbon reads as its range. */
function formatPathWidth(path: SitePath): string {
  const { meterUnit } = sitePlannerT.plan;
  const uniform = uniformPathWidth(path);

  if (!isNil(uniform)) {
    return formatMeters(uniform, meterUnit);
  }

  const widths = path.points.map(point => point.width);

  return `${Math.min(...widths).toFixed(METER_DECIMALS)}–${formatMeters(Math.max(...widths), meterUnit)}`;
}
