import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { Check, ChevronDown, Droplets } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';

import { Dropdown, DropdownItem } from '../../../../shared/ui/Dropdown';
import type { BuildingRoom, SitePlannerStore } from '../../application/SitePlannerStore';
import { editedBuildingId } from '../../domain/model/editor-mode';
import type { RoomTypeId } from '../../domain/model/rooms';
import { ROOM_TYPES } from '../../domain/model/rooms';
import type { BuildingId } from '../../domain/model/site-plan';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PlannerPanel } from './PlannerPanel';

const GLYPH_SIZE_PX = 12;
const AREA_DECIMALS = 1;

const RoomTypeItem = memo(
  ({
    roomTypeId,
    isSelected,
    onSelect,
  }: {
    readonly roomTypeId: RoomTypeId | undefined;
    readonly isSelected: boolean;
    readonly onSelect: (roomTypeId: RoomTypeId | undefined) => void;
  }) => {
    const handleSelect = useFunction(() => onSelect(roomTypeId));
    const caption = isNil(roomTypeId)
      ? sitePlannerT.rooms.unassigned
      : sitePlannerT.rooms.types[roomTypeId];

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
        {caption}
      </DropdownItem>
    );
  }
);

/** One derived region's row: its type to choose, its area to read. */
const RoomRow = observer(
  ({
    store,
    buildingId,
    room,
    ordinal,
  }: {
    readonly store: SitePlannerStore;
    readonly buildingId: BuildingId;
    readonly room: BuildingRoom;
    readonly ordinal: number;
  }) => {
    const labels = sitePlannerT.rooms;
    const caption = isNil(room.roomTypeId)
      ? `${labels.roomTitle} ${ordinal}`
      : labels.types[room.roomTypeId];

    const handleSelect = useFunction((roomTypeId: RoomTypeId | undefined) => {
      store.building.setRoomType(buildingId, room, roomTypeId);
    });
    const handlePointerEnter = useFunction(() => store.building.setHoveredRoomIndex(ordinal - 1));
    const handlePointerLeave = useFunction(() => store.building.setHoveredRoomIndex(undefined));

    return (
      <div
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        className={cn(
          'flex items-center gap-1.5 rounded-md border border-white/10 p-1.5',
          'transition-colors duration-150 hover:border-brand-500/50'
        )}
      >
        <Dropdown
          trigger={
            <button
              type="button"
              aria-label={caption}
              className={cn(
                'flex min-w-0 flex-1 items-center gap-1 rounded-md px-1 py-0.5 text-left',
                'text-[11px] text-text transition-colors duration-150 hover:bg-white/10',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
              )}
            >
              <span className="truncate">{caption}</span>
              <ChevronDown
                size={GLYPH_SIZE_PX}
                className="shrink-0 text-text-secondary"
                aria-hidden
              />
            </button>
          }
        >
          <RoomTypeItem
            roomTypeId={undefined}
            isSelected={isNil(room.roomTypeId)}
            onSelect={handleSelect}
          />
          {ROOM_TYPES.map(type => (
            <RoomTypeItem
              key={type.id}
              roomTypeId={type.id}
              isSelected={type.id === room.roomTypeId}
              onSelect={handleSelect}
            />
          ))}
        </Dropdown>
        {room.isWet ? (
          <Droplets
            size={GLYPH_SIZE_PX}
            className="shrink-0 text-sky-400"
            aria-label={labels.wet}
          />
        ) : undefined}
        <span className="shrink-0 font-mono text-[10px] text-text-secondary">
          {`${room.areaSquareMeters.toFixed(AREA_DECIMALS)} ${sitePlannerT.plan.squareMeterUnit}`}
        </span>
      </div>
    );
  }
);

/**
 * The building editor's derived rooms: never drawn
 * by hand — the walls cut the footprint, this panel names what they cut out.
 */
export const RoomsPanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const buildingId = editedBuildingId(store.editorMode);
  const scene = store.building.editedStoreyScene;

  if (isNil(buildingId) || isNil(scene)) {
    return null;
  }

  return (
    <PlannerPanel title={sitePlannerT.rooms.panelTitle}>
      {scene.rooms.map((room, index) => (
        <RoomRow
          // Regions are positional by nature: a room IS its place in the derivation.
          // oxlint-disable-next-line react/no-array-index-key -- derived regions have no identity beyond their order
          key={index}
          store={store}
          buildingId={buildingId}
          room={room}
          ordinal={index + 1}
        />
      ))}
      {scene.rooms.length === 0 ? <PanelHint>{sitePlannerT.rooms.emptyHint}</PanelHint> : undefined}
    </PlannerPanel>
  );
});
