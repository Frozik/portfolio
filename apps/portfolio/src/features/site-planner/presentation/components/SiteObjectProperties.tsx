import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { PencilRuler } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';

import { Button } from '../../../../shared/ui/Button';
import { RadioGroup } from '../../../../shared/ui/RadioGroup';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { editedPathId } from '../../domain/model/editor-mode';
import type {
  CarInstance,
  ElevationMark,
  PathPoint,
  SitePath,
  TreeInstance,
} from '../../domain/model/site-plan';
import {
  changeTreeSpecies,
  parseTreeSpecies,
  TREE_SPECIES,
  uniformPathWidth,
} from '../../domain/model/site-plan';
import { DEGREE_DECIMALS, EDIT_ICON_SIZE_PX, METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PropertyField } from './PropertyField';

/** The same grouping for a mark: a typed elevation is one step, not five. */
type MarkField = 'position-x' | 'position-y' | 'elevation';

/** And for a tree, whose four numbers are edited the same way. */
type TreeField = 'position-x' | 'position-y' | 'crown-radius' | 'height' | 'species';

/** A car has no dimensions to type — only where it stands and where it faces. */
type CarField = 'position-x' | 'position-y' | 'rotation';

const SPECIES_OPTIONS = TREE_SPECIES.map(species => ({
  value: species,
  label: sitePlannerT.properties.species[species],
}));

const MarkProperties = memo(
  ({
    mark,
    onChange,
  }: {
    readonly mark: ElevationMark;
    readonly onChange: (mark: ElevationMark, field: MarkField) => void;
  }) => {
    const handlePositionXChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange({ ...mark, position: { ...mark.position, x: value } }, 'position-x');
      }
    });
    const handlePositionYChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange({ ...mark, position: { ...mark.position, y: value } }, 'position-y');
      }
    });
    const handleElevationChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange({ ...mark, elevation: value }, 'elevation');
      }
    });

    return (
      <div className="flex flex-col gap-2">
        <PropertyField
          label={sitePlannerT.properties.centerX}
          value={mark.position.x}
          decimal={METER_DECIMALS}
          allowNegative
          onValueChange={handlePositionXChange}
        />
        <PropertyField
          label={sitePlannerT.properties.centerY}
          value={mark.position.y}
          decimal={METER_DECIMALS}
          allowNegative
          onValueChange={handlePositionYChange}
        />
        <PropertyField
          label={sitePlannerT.properties.elevation}
          value={mark.elevation}
          decimal={METER_DECIMALS}
          allowNegative
          onValueChange={handleElevationChange}
        />
      </div>
    );
  }
);

const TreeProperties = memo(
  ({
    tree,
    onChange,
  }: {
    readonly tree: TreeInstance;
    readonly onChange: (tree: TreeInstance, field: TreeField) => void;
  }) => {
    const handleSpeciesChange = useFunction((value: string) => {
      const species = parseTreeSpecies(value);

      if (!isNil(species)) {
        onChange(changeTreeSpecies(tree, species), 'species');
      }
    });
    const handlePositionXChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange({ ...tree, position: { ...tree.position, x: value } }, 'position-x');
      }
    });
    const handlePositionYChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange({ ...tree, position: { ...tree.position, y: value } }, 'position-y');
      }
    });
    const handleCrownRadiusChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange({ ...tree, crownRadius: value }, 'crown-radius');
      }
    });
    const handleHeightChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange({ ...tree, height: value }, 'height');
      }
    });

    return (
      <div className="flex flex-col gap-2">
        <span className="text-[11px] text-text-secondary">
          {sitePlannerT.properties.speciesLabel}
        </span>
        <RadioGroup options={SPECIES_OPTIONS} value={tree.species} onChange={handleSpeciesChange} />
        <PropertyField
          label={sitePlannerT.properties.centerX}
          value={tree.position.x}
          decimal={METER_DECIMALS}
          allowNegative
          onValueChange={handlePositionXChange}
        />
        <PropertyField
          label={sitePlannerT.properties.centerY}
          value={tree.position.y}
          decimal={METER_DECIMALS}
          allowNegative
          onValueChange={handlePositionYChange}
        />
        <PropertyField
          label={sitePlannerT.properties.crownRadius}
          value={tree.crownRadius}
          decimal={METER_DECIMALS}
          onValueChange={handleCrownRadiusChange}
        />
        <PropertyField
          label={sitePlannerT.properties.treeHeight}
          value={tree.height}
          decimal={METER_DECIMALS}
          onValueChange={handleHeightChange}
        />
      </div>
    );
  }
);

const CarProperties = memo(
  ({
    car,
    onChange,
  }: {
    readonly car: CarInstance;
    readonly onChange: (car: CarInstance, field: CarField) => void;
  }) => {
    const handlePositionXChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange({ ...car, position: { ...car.position, x: value } }, 'position-x');
      }
    });
    const handlePositionYChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange({ ...car, position: { ...car.position, y: value } }, 'position-y');
      }
    });
    const handleRotationChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange({ ...car, rotationDegrees: value }, 'rotation');
      }
    });

    return (
      <div className="flex flex-col gap-2">
        <PropertyField
          label={sitePlannerT.properties.centerX}
          value={car.position.x}
          decimal={METER_DECIMALS}
          allowNegative
          onValueChange={handlePositionXChange}
        />
        <PropertyField
          label={sitePlannerT.properties.centerY}
          value={car.position.y}
          decimal={METER_DECIMALS}
          allowNegative
          onValueChange={handlePositionYChange}
        />
        <PropertyField
          label={sitePlannerT.properties.rotation}
          value={car.rotationDegrees}
          decimal={DEGREE_DECIMALS}
          allowNegative
          onValueChange={handleRotationChange}
        />
      </div>
    );
  }
);

const PathProperties = memo(
  ({
    path,
    hint,
    onWidthChange,
  }: {
    readonly path: SitePath;
    readonly hint: string;
    readonly onWidthChange: (width: number) => void;
  }) => {
    const handleWidthChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onWidthChange(value);
      }
    });

    return (
      <div className="flex flex-col gap-2">
        <PropertyField
          label={sitePlannerT.properties.width}
          value={uniformPathWidth(path) ?? path.points[0].width}
          decimal={METER_DECIMALS}
          onValueChange={handleWidthChange}
        />
        {isNil(uniformPathWidth(path)) && (
          <PanelHint>{sitePlannerT.properties.mixedWidthHint}</PanelHint>
        )}
        <PanelHint>{hint}</PanelHint>
      </div>
    );
  }
);

export const SelectedMarkProperties = observer(
  ({ store, mark }: { readonly store: SitePlannerStore; readonly mark: ElevationMark }) => {
    const handleChange = useFunction((nextMark: ElevationMark, field: MarkField) => {
      store.pushHistory(`${nextMark.id}:${field}`);

      if (field === 'elevation') {
        store.siteObjects.setElevationMarkElevation(nextMark.id, nextMark.elevation);

        return;
      }

      store.siteObjects.moveElevationMark(nextMark.id, nextMark.position);
    });

    return <MarkProperties mark={mark} onChange={handleChange} />;
  }
);

export const SelectedTreeProperties = observer(
  ({ store, tree }: { readonly store: SitePlannerStore; readonly tree: TreeInstance }) => {
    const handleChange = useFunction((nextTree: TreeInstance, field: TreeField) => {
      store.pushHistory(`${nextTree.id}:${field}`);
      store.siteObjects.updateTree(nextTree);
    });

    return <TreeProperties tree={tree} onChange={handleChange} />;
  }
);

export const SelectedCarProperties = observer(
  ({ store, car }: { readonly store: SitePlannerStore; readonly car: CarInstance }) => {
    const handleChange = useFunction((nextCar: CarInstance, field: CarField) => {
      store.pushHistory(`${nextCar.id}:${field}`);
      store.siteObjects.updateCar(nextCar);
    });

    return <CarProperties car={car} onChange={handleChange} />;
  }
);

export const SelectedPathProperties = observer(
  ({ store, path }: { readonly store: SitePlannerStore; readonly path: SitePath }) => {
    const isEditingThisPath = editedPathId(store.editorMode) === path.id;

    const handleWidthChange = useFunction((width: number) => {
      store.pushHistory(`${path.id}:width`);
      store.siteObjects.setPathWidth(path.id, width);
    });

    const handleEnterEditMode = useFunction(() =>
      store.openEditorDoor({ target: { kind: 'path', pathId: path.id }, aimAt: undefined })
    );

    if (!isEditingThisPath) {
      return (
        <div className="flex flex-col gap-2">
          <PathProperties
            path={path}
            hint={sitePlannerT.properties.pathViewHint}
            onWidthChange={handleWidthChange}
          />
          <Button variant="secondary" size="sm" onClick={handleEnterEditMode}>
            <PencilRuler size={EDIT_ICON_SIZE_PX} aria-hidden />
            {sitePlannerT.modes.editPath}
          </Button>
        </div>
      );
    }

    const pointIndex = store.selectedPathPointIndex;
    const point = isNil(pointIndex) ? undefined : path.points[pointIndex];

    if (isNil(pointIndex) || isNil(point)) {
      return (
        <PathProperties
          path={path}
          hint={sitePlannerT.properties.pathPointsHint}
          onWidthChange={handleWidthChange}
        />
      );
    }

    return <PathPointProperties store={store} path={path} pointIndex={pointIndex} point={point} />;
  }
);

/** The opened point of path editing: where it stands, and how wide the ribbon runs through it. */
const PathPointProperties = observer(
  ({
    store,
    path,
    pointIndex,
    point,
  }: {
    readonly store: SitePlannerStore;
    readonly path: SitePath;
    readonly pointIndex: number;
    readonly point: PathPoint;
  }) => {
    const handlePositionXChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        store.pushHistory(`${path.id}:point:${pointIndex}:x`);
        store.siteObjects.movePathPoint(path.id, pointIndex, { x: value, y: point.position.y });
      }
    });
    const handlePositionYChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        store.pushHistory(`${path.id}:point:${pointIndex}:y`);
        store.siteObjects.movePathPoint(path.id, pointIndex, { x: point.position.x, y: value });
      }
    });
    const handleWidthChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        store.pushHistory(`${path.id}:point:${pointIndex}:width`);
        store.siteObjects.setPathPointWidth(path.id, pointIndex, value);
      }
    });

    return (
      <div className="flex flex-col gap-2">
        <span className="text-[11px] text-text-secondary">
          {sitePlannerT.properties.pathPointLabel} {pointIndex + 1} / {path.points.length}
        </span>
        <PropertyField
          label={sitePlannerT.properties.centerX}
          value={point.position.x}
          decimal={METER_DECIMALS}
          allowNegative
          onValueChange={handlePositionXChange}
        />
        <PropertyField
          label={sitePlannerT.properties.centerY}
          value={point.position.y}
          decimal={METER_DECIMALS}
          allowNegative
          onValueChange={handlePositionYChange}
        />
        <PropertyField
          label={sitePlannerT.properties.width}
          value={point.width}
          decimal={METER_DECIMALS}
          onValueChange={handleWidthChange}
        />
        <PanelHint>{sitePlannerT.properties.pathPointHint}</PanelHint>
      </div>
    );
  }
);
