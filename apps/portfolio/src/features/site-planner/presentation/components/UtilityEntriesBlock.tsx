import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';

import { Dropdown, DropdownItem } from '../../../../shared/ui/Dropdown';
import type { BuildingScene } from '../../application/building-scene';
import { UTILITY_SYSTEM_COLORS } from '../../application/render/plan-draw/draw-house';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { UtilityEntry, UtilitySystem } from '../../domain/model/foundation';
import { ENTRY_SYSTEMS } from '../../domain/model/foundation';
import { entriesOf } from '../../domain/model/site-plan';
import { METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import { PropertyField } from './PropertyField';

const GLYPH_SIZE_PX = 12;

const AddEntryItem = memo(
  ({
    system,
    onSelect,
  }: {
    readonly system: UtilitySystem;
    readonly onSelect: (system: UtilitySystem) => void;
  }) => {
    const handleSelect = useFunction(() => onSelect(system));

    return (
      <DropdownItem onSelect={handleSelect} className="gap-2 py-1.5 text-xs">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: UTILITY_SYSTEM_COLORS[system] }}
          aria-hidden
        />
        {sitePlannerT.house.entries.systems[system]}
      </DropdownItem>
    );
  }
);

/** One entry's row: where along the outline it sits, and how deep it goes. */
const EntryRow = observer(
  ({
    store,
    scene,
    entry,
  }: {
    readonly store: SitePlannerStore;
    readonly scene: BuildingScene;
    readonly entry: UtilityEntry;
  }) => {
    const labels = sitePlannerT.house.entries;
    const { building } = scene;

    const handleOffsetChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        store.utilities.updateUtilityEntry(building.id, entry.id, {
          outlineOffsetMeters: value,
          floorPosition: undefined,
        });
      }
    });
    const handleFloorXChange = useFunction((value: number | undefined) => {
      if (!isNil(value) && !isNil(entry.floorPosition)) {
        store.utilities.updateUtilityEntry(building.id, entry.id, {
          floorPosition: { x: value, y: entry.floorPosition.y },
        });
      }
    });
    const handleFloorYChange = useFunction((value: number | undefined) => {
      if (!isNil(value) && !isNil(entry.floorPosition)) {
        store.utilities.updateUtilityEntry(building.id, entry.id, {
          floorPosition: { x: entry.floorPosition.x, y: value },
        });
      }
    });
    const handleDepthChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        store.utilities.updateUtilityEntry(building.id, entry.id, { depthMeters: value });
      }
    });
    const handleRemove = useFunction(() => {
      store.utilities.removeUtilityEntry(building.id, entry.id);
    });
    const handleSelect = useFunction(() => {
      store.setSelection({ kind: 'utilityEntry', buildingId: building.id, entryId: entry.id });
    });
    const isSelected =
      store.selection?.kind === 'utilityEntry' && store.selection.entryId === entry.id;

    return (
      <div
        onClick={handleSelect}
        className={cn(
          'flex flex-col gap-1 rounded-md border p-1.5',
          isSelected ? 'border-brand-500/60' : 'border-white/10'
        )}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: UTILITY_SYSTEM_COLORS[entry.system] }}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate text-[11px] text-text">
            {labels.systems[entry.system]}
            <span className="text-text-secondary">
              {' '}
              · {isNil(entry.floorPosition) ? labels.kinds[entry.kind] : labels.throughFloor}
            </span>
          </span>
          <button
            type="button"
            aria-label={labels.remove}
            title={labels.remove}
            onClick={handleRemove}
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded-md',
              'text-text-secondary transition-colors duration-150 hover:bg-white/10 hover:text-text',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
            )}
          >
            <Trash2 size={GLYPH_SIZE_PX} aria-hidden />
          </button>
        </div>
        {isNil(entry.floorPosition) ? (
          <PropertyField
            label={labels.offset}
            value={entry.outlineOffsetMeters}
            decimal={METER_DECIMALS}
            onValueChange={handleOffsetChange}
          />
        ) : (
          <>
            <PropertyField
              label={labels.floorX}
              value={entry.floorPosition.x}
              decimal={METER_DECIMALS}
              allowNegative
              onValueChange={handleFloorXChange}
            />
            <PropertyField
              label={labels.floorY}
              value={entry.floorPosition.y}
              decimal={METER_DECIMALS}
              allowNegative
              onValueChange={handleFloorYChange}
            />
          </>
        )}
        <PropertyField
          label={entry.kind === 'facade' ? labels.facadeHeight : labels.depth}
          value={entry.depthMeters}
          decimal={METER_DECIMALS}
          onValueChange={handleDepthChange}
        />
      </div>
    );
  }
);

/**
 * Where each system enters the building: the seam a
 * site trench and an indoor route will meet at. The list twin of the plan's
 * own badges: a row click selects the badge, the badge drags along the
 * outline, and either way the same entry answers.
 */
export const EntriesBlock = observer(
  ({ store, scene }: { readonly store: SitePlannerStore; readonly scene: BuildingScene }) => {
    const labels = sitePlannerT.house.entries;
    const entries = entriesOf(scene.building);

    const handleAdd = useFunction((system: UtilitySystem) => {
      store.utilities.addUtilityEntry(scene.building.id, system);
    });

    return (
      <div className="flex flex-col gap-1 rounded-lg border border-white/10 p-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-text-secondary">
          {labels.title}
        </span>
        {entries.map(entry => (
          <EntryRow key={entry.id} store={store} scene={scene} entry={entry} />
        ))}
        <Dropdown
          trigger={
            <button
              type="button"
              className={cn(
                'rounded-md border border-dashed border-white/20 px-2 py-1 text-[11px]',
                'text-text-secondary transition-colors duration-150',
                'hover:border-brand-500/50 hover:text-text',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
              )}
            >
              {labels.add}
            </button>
          }
        >
          {ENTRY_SYSTEMS.map(system => (
            <AddEntryItem key={system} system={system} onSelect={handleAdd} />
          ))}
        </Dropdown>
      </div>
    );
  }
);

/**
 * The properties card of a selected entry badge: the same row the ИНЖЕНЕРИЯ
 * list shows, standing alone — offset along the outline, depth, removal.
 */
export const SelectedEntryProperties = observer(
  ({ store }: { readonly store: SitePlannerStore }) => {
    const selected = store.utilities.selectedUtilityEntry;
    const scene = store.scene.buildingScenes.find(
      candidate => candidate.building.id === selected?.buildingId
    );

    if (isNil(selected) || isNil(scene)) {
      return null;
    }

    return <EntryRow store={store} scene={scene} entry={selected.entry} />;
  }
);
