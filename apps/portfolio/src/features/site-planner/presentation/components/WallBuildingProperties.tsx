import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { PencilRuler } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ChangeEvent } from 'react';

import { Button } from '../../../../shared/ui/Button';
import { RadioGroup } from '../../../../shared/ui/RadioGroup';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { Building } from '../../domain/model/site-plan';
import type { Wall } from '../../domain/model/walls';
import {
  isWallClosed,
  MIN_CLOSED_WALL_POINTS,
  parseWallMaterial,
  parseWallReferenceLine,
  WALL_MATERIAL_DEFAULT_THICKNESS,
  WALL_MATERIALS,
  WALL_REFERENCE_LINES,
} from '../../domain/model/walls';
import { EDIT_ICON_SIZE_PX, METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PropertyField } from './PropertyField';
import { PropertyRow, PropertyValue } from './PropertyRow';

const WALL_MATERIAL_OPTIONS = WALL_MATERIALS.map(material => ({
  value: material,
  label: sitePlannerT.walls.materials[material],
}));

const REFERENCE_LINE_OPTIONS = WALL_REFERENCE_LINES.map(line => ({
  value: line,
  label: sitePlannerT.walls.referenceLines[line],
}));

/**
 * A wall opened inside the building editor: its construction is data — the
 * material and reference line switch, the thickness types, and the body
 * re-derives (`building-editor.md` §4).
 */
export const SelectedWallProperties = observer(
  ({ store, wall }: { readonly store: SitePlannerStore; readonly wall: Wall }) => {
    const { selection } = store;
    const buildingId = selection?.kind === 'wall' ? selection.buildingId : undefined;
    const labels = sitePlannerT.walls;

    const handleMaterialChange = useFunction((value: string) => {
      const material = parseWallMaterial(value);

      if (!isNil(buildingId) && !isNil(material)) {
        // A new construction brings its typical thickness with it; a typed
        // thickness is a later edit that then survives on its own.
        store.updateWallProperties(buildingId, wall.id, {
          material,
          thicknessMeters: WALL_MATERIAL_DEFAULT_THICKNESS[material],
        });
      }
    });
    const handleThicknessChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value)) {
        store.updateWallProperties(buildingId, wall.id, { thicknessMeters: value });
      }
    });
    const handleReferenceLineChange = useFunction((value: string) => {
      const referenceLine = parseWallReferenceLine(value);

      if (!isNil(buildingId) && !isNil(referenceLine)) {
        store.updateWallProperties(buildingId, wall.id, { referenceLine });
      }
    });
    const handleCloseRing = useFunction(() => {
      if (!isNil(buildingId)) {
        store.closeWallRing(buildingId, wall.id);
      }
    });

    return (
      <div className="flex flex-col gap-2">
        <PropertyRow label={labels.material} isControlStretched>
          <RadioGroup
            value={wall.material}
            options={WALL_MATERIAL_OPTIONS}
            onChange={handleMaterialChange}
          />
        </PropertyRow>
        <PropertyField
          label={labels.thickness}
          value={wall.thicknessMeters}
          decimal={METER_DECIMALS}
          onValueChange={handleThicknessChange}
        />
        <PropertyRow label={labels.referenceLine} isControlStretched>
          <RadioGroup
            value={wall.referenceLine}
            options={REFERENCE_LINE_OPTIONS}
            onChange={handleReferenceLineChange}
          />
        </PropertyRow>
        {isWallClosed(wall) ? (
          <PropertyRow label={labels.contour}>
            <PropertyValue value={labels.contourClosed} />
          </PropertyRow>
        ) : wall.points.length >= MIN_CLOSED_WALL_POINTS ? (
          <Button variant="secondary" size="sm" onClick={handleCloseRing}>
            {labels.closeRing}
          </Button>
        ) : undefined}
        <PanelHint>{isWallClosed(wall) ? labels.closedHint : labels.hint}</PanelHint>
      </div>
    );
  }
);

/**
 * A building taken hold of in view mode: named, movable by drag, its anatomy a
 * click away. The name edits here too — the same rename the buildings panel
 * offers inside the editor.
 */
export const SelectedBuildingProperties = observer(
  ({ store, building }: { readonly store: SitePlannerStore; readonly building: Building }) => {
    const handleNameChange = useFunction((event: ChangeEvent<HTMLInputElement>) => {
      store.renameBuilding(building.id, event.target.value);
    });
    const handleEdit = useFunction(() => {
      store.openEditorDoor({
        target: { kind: 'building', buildingId: building.id },
        aimAt: undefined,
      });
    });

    return (
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={building.name}
          aria-label={sitePlannerT.house.nameLabel}
          onChange={handleNameChange}
          className={cn(
            'w-full rounded-md border border-transparent bg-transparent px-1 py-0.5',
            'text-xs font-medium text-text transition-colors duration-150',
            'hover:border-white/10 focus:border-brand-500 focus:outline-none'
          )}
        />
        <Button variant="secondary" size="sm" onClick={handleEdit}>
          <PencilRuler size={EDIT_ICON_SIZE_PX} aria-hidden />
          {sitePlannerT.modes.editHouse}
        </Button>
        <PanelHint>{sitePlannerT.properties.buildingHint}</PanelHint>
      </div>
    );
  }
);
