import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil, round } from 'lodash-es';
import { PencilRuler } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ChangeEvent, RefObject } from 'react';
import { memo, useEffect, useRef } from 'react';

import { Button } from '../../../../shared/ui/Button';
import { RadioGroup } from '../../../../shared/ui/RadioGroup';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import {
  anchorPlanPosition,
  moveShapeByAnchor,
  rotateRectangleAroundAnchor,
} from '../../domain/geometry/shape-anchor';
import { editedPathId, editedUtilityRouteId } from '../../domain/model/editor-mode';
import type { ElectricalDevice } from '../../domain/model/electrical';
import { DEVICE_KINDS, parseDeviceKind } from '../../domain/model/electrical';
import type { FurnitureInstance } from '../../domain/model/furniture';
import type { Opening } from '../../domain/model/openings';
import { OPENING_PRESETS, parseOpeningPreset } from '../../domain/model/openings';
import type { UtilityRoute } from '../../domain/model/routing';
import {
  parseTrenchSystem,
  routeDiameterMeters,
  routeLengthMeters,
  TRENCH_SYSTEMS,
} from '../../domain/model/routing';
import type { CircleShape, GroupTerm, RectangleShape, Shape } from '../../domain/model/shapes';
import { flattenShapes } from '../../domain/model/shapes';
import type {
  Building,
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
import { formatMeters } from '../../domain/plan-draw/shared';
import { normalizeTurnDegrees } from '../../domain/units';
import {
  DEGREE_DECIMALS,
  FLYOUT_ICON_SIZE_PX,
  METER_DECIMALS,
  PLACED_OBJECT_TOOL,
} from '../constants';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PlacedObjectIcon } from './PlacedObjectIcon';
import { PlannerPanel } from './PlannerPanel';
import { focusPropertyField, PropertyField } from './PropertyField';
import { PropertyRow, PropertyValue } from './PropertyRow';
import { describePlacedObject } from './placedObjectLabel';
import { toolHint } from './toolHints';

/** Which of the shape's numbers an edit came from — the history groups by it. */
type ShapeField = 'center-x' | 'center-y' | 'width' | 'length' | 'rotation' | 'radius';

type ShapeFieldChange = (shape: Shape, field: ShapeField) => void;

/** The same grouping for a mark: a typed elevation is one step, not five. */
type MarkField = 'position-x' | 'position-y' | 'elevation';

/** And for a tree, whose four numbers are edited the same way. */
type TreeField = 'position-x' | 'position-y' | 'crown-radius' | 'height' | 'species';

/** A car has no dimensions to type — only where it stands and where it faces. */
type CarField = 'position-x' | 'position-y' | 'rotation';

const EDIT_ICON_SIZE_PX = 14;
/** Millimetre precision: enough for any plan reading, none of the float tails. */
const ANCHOR_DISPLAY_DECIMALS = 3;

const SPECIES_OPTIONS = TREE_SPECIES.map(species => ({
  value: species,
  label: sitePlannerT.properties.species[species],
}));

const OPENING_PRESET_OPTIONS = OPENING_PRESETS.map(preset => ({
  value: preset,
  label: sitePlannerT.openings.presets[preset],
}));

const DEVICE_KIND_OPTIONS = DEVICE_KINDS.map(kind => ({
  value: kind,
  label: sitePlannerT.electrical.kinds[kind],
}));

const TRENCH_SYSTEM_OPTIONS = TRENCH_SYSTEMS.map(system => ({
  value: system,
  label: sitePlannerT.utilities.systems[system],
}));

/** Burial figures are read to the centimetre; the digging is not finer. */
const TRENCH_DEPTH_DECIMALS = 2;
/** The Russian convention quotes a sewer's fall in centimetres per metre. */
const SLOPE_CM_PER_METER = 100;
const SLOPE_DECIMALS = 1;

const WALL_MATERIAL_OPTIONS = WALL_MATERIALS.map(material => ({
  value: material,
  label: sitePlannerT.walls.materials[material],
}));

const REFERENCE_LINE_OPTIONS = WALL_REFERENCE_LINES.map(line => ({
  value: line,
  label: sitePlannerT.walls.referenceLines[line],
}));

/** A group has no dimensions of its own — only how it joins the fold above it. */
const OPERATION_OPTIONS = [
  { value: 'union', label: sitePlannerT.structure.union },
  { value: 'subtract', label: sitePlannerT.structure.subtract },
];

/**
 * The field a freshly drawn shape hands the keyboard to: its first dimension,
 * which is the width of a rectangle and the radius of a circle.
 */
type SizeFieldRef = RefObject<HTMLFieldSetElement | null>;

const RectangleProperties = memo(
  ({
    shape,
    sizeFieldRef,
    onChange,
  }: {
    readonly shape: RectangleShape;
    readonly sizeFieldRef: SizeFieldRef;
    readonly onChange: ShapeFieldChange;
  }) => {
    // The rotation trigonometry leaves 1e-15 tails; the field shows a reading.
    const rawAnchor = anchorPlanPosition(shape);
    const anchor = {
      x: round(rawAnchor.x, ANCHOR_DISPLAY_DECIMALS),
      y: round(rawAnchor.y, ANCHOR_DISPLAY_DECIMALS),
    };
    const handleCenterXChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange(moveShapeByAnchor(shape, { x: value, y: anchor.y }), 'center-x');
      }
    });
    const handleCenterYChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange(moveShapeByAnchor(shape, { x: anchor.x, y: value }), 'center-y');
      }
    });
    const handleWidthChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange({ ...shape, width: value }, 'width');
      }
    });
    const handleLengthChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange({ ...shape, length: value }, 'length');
      }
    });
    const handleRotationChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange(rotateRectangleAroundAnchor(shape, normalizeTurnDegrees(value)), 'rotation');
      }
    });

    return (
      <div className="flex flex-col gap-2">
        <PropertyField
          label={sitePlannerT.properties.centerX}
          value={anchor.x}
          decimal={METER_DECIMALS}
          allowNegative
          onValueChange={handleCenterXChange}
        />
        <PropertyField
          label={sitePlannerT.properties.centerY}
          value={anchor.y}
          decimal={METER_DECIMALS}
          allowNegative
          onValueChange={handleCenterYChange}
        />
        <PropertyField
          ref={sizeFieldRef}
          label={sitePlannerT.properties.width}
          value={shape.width}
          decimal={METER_DECIMALS}
          onValueChange={handleWidthChange}
        />
        <PropertyField
          label={sitePlannerT.properties.length}
          value={shape.length}
          decimal={METER_DECIMALS}
          onValueChange={handleLengthChange}
        />
        <PropertyField
          label={sitePlannerT.properties.rotation}
          value={shape.rotationDegrees}
          decimal={DEGREE_DECIMALS}
          allowNegative
          onValueChange={handleRotationChange}
        />
      </div>
    );
  }
);

const CircleProperties = memo(
  ({
    shape,
    sizeFieldRef,
    onChange,
  }: {
    readonly shape: CircleShape;
    readonly sizeFieldRef: SizeFieldRef;
    readonly onChange: ShapeFieldChange;
  }) => {
    // The rotation trigonometry leaves 1e-15 tails; the field shows a reading.
    const rawAnchor = anchorPlanPosition(shape);
    const anchor = {
      x: round(rawAnchor.x, ANCHOR_DISPLAY_DECIMALS),
      y: round(rawAnchor.y, ANCHOR_DISPLAY_DECIMALS),
    };
    const handleCenterXChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange(moveShapeByAnchor(shape, { x: value, y: anchor.y }), 'center-x');
      }
    });
    const handleCenterYChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange(moveShapeByAnchor(shape, { x: anchor.x, y: value }), 'center-y');
      }
    });
    const handleRadiusChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        onChange({ ...shape, radius: value }, 'radius');
      }
    });

    return (
      <div className="flex flex-col gap-2">
        <PropertyField
          label={sitePlannerT.properties.centerX}
          value={anchor.x}
          decimal={METER_DECIMALS}
          allowNegative
          onValueChange={handleCenterXChange}
        />
        <PropertyField
          label={sitePlannerT.properties.centerY}
          value={anchor.y}
          decimal={METER_DECIMALS}
          allowNegative
          onValueChange={handleCenterYChange}
        />
        <PropertyField
          ref={sizeFieldRef}
          label={sitePlannerT.properties.radius}
          value={shape.radius}
          decimal={METER_DECIMALS}
          onValueChange={handleRadiusChange}
        />
      </div>
    );
  }
);

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

/**
 * What the panel shows with nothing selected: the hint for the tool in hand,
 * and — while that tool places objects — what it is armed with. The choosing
 * itself belongs to the tool button's flyout, where the tool is picked up.
 */
const EmptyProperties = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const { activeTool } = store;

  if (activeTool === PLACED_OBJECT_TOOL) {
    const armedObject = store.nextPlacedObject;

    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] text-text-secondary">
          {sitePlannerT.properties.placingLabel}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-text">
          <PlacedObjectIcon
            object={armedObject}
            width={FLYOUT_ICON_SIZE_PX}
            height={FLYOUT_ICON_SIZE_PX}
            className="shrink-0"
          />
          <span className="min-w-0 truncate">{describePlacedObject(armedObject)}</span>
        </span>
        <PanelHint>{sitePlannerT.properties.placingHint}</PanelHint>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-text-secondary">{sitePlannerT.properties.empty}</span>
      <PanelHint>{toolHint(activeTool)}</PanelHint>
    </div>
  );
});

const SelectedMarkProperties = observer(
  ({ store, mark }: { readonly store: SitePlannerStore; readonly mark: ElevationMark }) => {
    const handleChange = useFunction((nextMark: ElevationMark, field: MarkField) => {
      store.pushHistory(`${nextMark.id}:${field}`);

      if (field === 'elevation') {
        store.setElevationMarkElevation(nextMark.id, nextMark.elevation);

        return;
      }

      store.moveElevationMark(nextMark.id, nextMark.position);
    });

    return <MarkProperties mark={mark} onChange={handleChange} />;
  }
);

const SelectedTreeProperties = observer(
  ({ store, tree }: { readonly store: SitePlannerStore; readonly tree: TreeInstance }) => {
    const handleChange = useFunction((nextTree: TreeInstance, field: TreeField) => {
      store.pushHistory(`${nextTree.id}:${field}`);
      store.updateTree(nextTree);
    });

    return <TreeProperties tree={tree} onChange={handleChange} />;
  }
);

const SelectedCarProperties = observer(
  ({ store, car }: { readonly store: SitePlannerStore; readonly car: CarInstance }) => {
    const handleChange = useFunction((nextCar: CarInstance, field: CarField) => {
      store.pushHistory(`${nextCar.id}:${field}`);
      store.updateCar(nextCar);
    });

    return <CarProperties car={car} onChange={handleChange} />;
  }
);

const SelectedPathProperties = observer(
  ({ store, path }: { readonly store: SitePlannerStore; readonly path: SitePath }) => {
    const isEditingThisPath = editedPathId(store.editorMode) === path.id;

    const handleWidthChange = useFunction((width: number) => {
      store.pushHistory(`${path.id}:width`);
      store.setPathWidth(path.id, width);
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
        store.movePathPoint(path.id, pointIndex, { x: value, y: point.position.y });
      }
    });
    const handlePositionYChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        store.pushHistory(`${path.id}:point:${pointIndex}:y`);
        store.movePathPoint(path.id, pointIndex, { x: point.position.x, y: value });
      }
    });
    const handleWidthChange = useFunction((value: number | undefined) => {
      if (!isNil(value)) {
        store.pushHistory(`${path.id}:point:${pointIndex}:width`);
        store.setPathPointWidth(path.id, pointIndex, value);
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

/**
 * A selected group: how it joins the fold that holds it, and how much it holds.
 * There is nothing else to type for it — a group has no geometry of its own, and
 * the shapes it folds are edited one by one through the structure panel.
 */
const SelectedGroupProperties = observer(
  ({ store, groupTerm }: { readonly store: SitePlannerStore; readonly groupTerm: GroupTerm }) => {
    const { selection } = store;
    const { group, operation } = groupTerm;

    const handleOperationChange = useFunction((value: string) => {
      if (value !== operation && !isNil(selection) && selection.kind === 'group') {
        store.toggleTermOperation(selection.owner, group.id);
      }
    });

    return (
      <div className="flex flex-col gap-2">
        <span className="text-[11px] text-text-secondary">
          {sitePlannerT.properties.groupOperation}
        </span>
        <RadioGroup
          options={OPERATION_OPTIONS}
          value={operation}
          onChange={handleOperationChange}
        />
        <PropertyRow label={sitePlannerT.properties.groupShapeCount}>
          <PropertyValue value={String(flattenShapes(group).length)} />
        </PropertyRow>
        <PanelHint>{sitePlannerT.properties.groupHint}</PanelHint>
      </div>
    );
  }
);

const SelectedShapeProperties = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const shape = store.selectedShape;
  const { isPropertiesFocusPending } = store;
  const sizeFieldRef = useRef<HTMLFieldSetElement>(null);
  // Typing a number arrives one keystroke at a time; the field the keystrokes
  // belong to is what collapses them into a single step to undo.
  const handleChange = useFunction((nextShape: Shape, field: ShapeField) => {
    store.pushHistory(`${nextShape.id}:${field}`);
    store.updateSelectedShape(nextShape);
  });

  // A shape just drawn with the pointer asks for the keyboard, so its rough
  // dimension can be replaced by the surveyed one without reaching for the
  // mouse again.
  useEffect(() => {
    if (!isPropertiesFocusPending) {
      return;
    }

    store.consumePropertiesFocus();
    focusPropertyField(sizeFieldRef.current);
  }, [store, isPropertiesFocusPending]);

  if (isNil(shape)) {
    return <EmptyProperties store={store} />;
  }

  switch (shape.kind) {
    case 'rectangle':
      return (
        <RectangleProperties shape={shape} sizeFieldRef={sizeFieldRef} onChange={handleChange} />
      );
    case 'circle':
      return <CircleProperties shape={shape} sizeFieldRef={sizeFieldRef} onChange={handleChange} />;
    default:
      return assertNever(shape);
  }
});

/**
 * An opening taken hold of inside the building editor. Its position is one
 * number — the offset along its host wall — and its heights are typed; the
 * kind never changes (a door replaced by a window is a delete and a click).
 */
const SelectedOpeningProperties = observer(
  ({ store, opening }: { readonly store: SitePlannerStore; readonly opening: Opening }) => {
    const { selection } = store;
    const buildingId = selection?.kind === 'opening' ? selection.buildingId : undefined;
    const labels = sitePlannerT.openings;

    const handleOffsetChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value)) {
        store.updateOpeningProperties(buildingId, opening.id, { offsetMeters: value });
      }
    });
    const handleWidthChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value)) {
        store.updateOpeningProperties(buildingId, opening.id, { widthMeters: value });
      }
    });
    const handleSillChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value)) {
        store.updateOpeningProperties(buildingId, opening.id, { sillMeters: value });
      }
    });
    const handleHeadChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value)) {
        store.updateOpeningProperties(buildingId, opening.id, { headMeters: value });
      }
    });

    return (
      <div className="flex flex-col gap-2">
        <PropertyRow label={labels.kinds[opening.kind]}>
          <PropertyValue value="" />
        </PropertyRow>
        <PropertyField
          label={labels.offset}
          value={opening.offsetMeters}
          decimal={METER_DECIMALS}
          onValueChange={handleOffsetChange}
        />
        <PropertyField
          label={labels.width}
          value={opening.widthMeters}
          decimal={METER_DECIMALS}
          onValueChange={handleWidthChange}
        />
        <PropertyField
          label={labels.sill}
          value={opening.sillMeters}
          decimal={METER_DECIMALS}
          onValueChange={handleSillChange}
        />
        <PropertyField
          label={labels.head}
          value={opening.headMeters}
          decimal={METER_DECIMALS}
          onValueChange={handleHeadChange}
        />
        <PanelHint>{labels.hint}</PanelHint>
      </div>
    );
  }
);

/**
 * A placed piece: where it stands, which way it faces, and how high above the
 * floor it sits — the elevation that hangs a boiler on a wall.
 */
const SelectedFurnitureProperties = observer(
  ({
    store,
    furniture,
  }: {
    readonly store: SitePlannerStore;
    readonly furniture: FurnitureInstance;
  }) => {
    const { selection } = store;
    const buildingId = selection?.kind === 'furniture' ? selection.buildingId : undefined;
    const labels = sitePlannerT.furniture;

    const handleXChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value)) {
        store.updateFurnitureProperties(buildingId, furniture.id, {
          position: { x: value, y: furniture.position.y },
        });
      }
    });
    const handleYChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value)) {
        store.updateFurnitureProperties(buildingId, furniture.id, {
          position: { x: furniture.position.x, y: value },
        });
      }
    });
    const handleRotationChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value)) {
        store.updateFurnitureProperties(buildingId, furniture.id, {
          rotationDegrees: normalizeTurnDegrees(value),
        });
      }
    });
    const handleElevationChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value)) {
        store.updateFurnitureProperties(buildingId, furniture.id, { elevationMeters: value });
      }
    });

    return (
      <div className="flex flex-col gap-2">
        <PropertyRow label={labels.items[furniture.catalogId]}>
          <PropertyValue value="" />
        </PropertyRow>
        <PropertyField
          label={sitePlannerT.properties.centerX}
          value={furniture.position.x}
          decimal={METER_DECIMALS}
          allowNegative
          onValueChange={handleXChange}
        />
        <PropertyField
          label={sitePlannerT.properties.centerY}
          value={furniture.position.y}
          decimal={METER_DECIMALS}
          allowNegative
          onValueChange={handleYChange}
        />
        <PropertyField
          label={sitePlannerT.properties.rotation}
          value={furniture.rotationDegrees}
          decimal={DEGREE_DECIMALS}
          allowNegative
          onValueChange={handleRotationChange}
        />
        <PropertyField
          label={labels.elevation}
          value={furniture.elevationMeters}
          decimal={METER_DECIMALS}
          onValueChange={handleElevationChange}
        />
        <PanelHint>{labels.hint}</PanelHint>
      </div>
    );
  }
);

/**
 * A placed device: a wall one slides by its offset and mounts at its height;
 * a ceiling light stands at a free point.
 */
const SelectedDeviceProperties = observer(
  ({ store, device }: { readonly store: SitePlannerStore; readonly device: ElectricalDevice }) => {
    const { selection } = store;
    const buildingId = selection?.kind === 'device' ? selection.buildingId : undefined;
    const labels = sitePlannerT.electrical;
    const { host } = device;

    const handleOffsetChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value) && host.kind === 'wall') {
        store.updateDeviceProperties(buildingId, device.id, {
          host: { ...host, offsetMeters: value },
        });
      }
    });
    const handleHeightChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value) && host.kind === 'wall') {
        store.updateDeviceProperties(buildingId, device.id, {
          host: { ...host, heightMeters: value },
        });
      }
    });
    const handleXChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value) && host.kind === 'ceiling') {
        store.updateDeviceProperties(buildingId, device.id, {
          host: { kind: 'ceiling', position: { x: value, y: host.position.y } },
        });
      }
    });
    const handleYChange = useFunction((value: number | undefined) => {
      if (!isNil(buildingId) && !isNil(value) && host.kind === 'ceiling') {
        store.updateDeviceProperties(buildingId, device.id, {
          host: { kind: 'ceiling', position: { x: host.position.x, y: value } },
        });
      }
    });

    return (
      <div className="flex flex-col gap-2">
        <PropertyRow label={labels.kinds[device.kind]}>
          <PropertyValue value="" />
        </PropertyRow>
        {host.kind === 'wall' ? (
          <>
            <PropertyField
              label={labels.offset}
              value={host.offsetMeters}
              decimal={METER_DECIMALS}
              onValueChange={handleOffsetChange}
            />
            <PropertyField
              label={labels.height}
              value={host.heightMeters}
              decimal={METER_DECIMALS}
              onValueChange={handleHeightChange}
            />
          </>
        ) : (
          <>
            <PropertyField
              label={sitePlannerT.properties.centerX}
              value={host.position.x}
              decimal={METER_DECIMALS}
              allowNegative
              onValueChange={handleXChange}
            />
            <PropertyField
              label={sitePlannerT.properties.centerY}
              value={host.position.y}
              decimal={METER_DECIMALS}
              allowNegative
              onValueChange={handleYChange}
            />
          </>
        )}
        <PanelHint>{labels.deviceHint}</PanelHint>
      </div>
    );
  }
);

/**
 * A drawn trench: the system is data, and everything below grade reads back
 * derived — length, burial range and a sewer's slope come from the norms
 * against the terrain, so only the system and a sewer's bore are typed.
 */
const SelectedUtilityRouteProperties = observer(
  ({ store, route }: { readonly store: SitePlannerStore; readonly route: UtilityRoute }) => {
    const labels = sitePlannerT.utilities;
    const profile = store.trenchProfiles.get(route.id);
    const isEditingThisRoute = editedUtilityRouteId(store.editorMode) === route.id;

    const handleSystemChange = useFunction((value: string) => {
      const system = parseTrenchSystem(value);

      if (!isNil(system)) {
        store.setUtilityRouteSystem(route.id, system);
      }
    });
    const handleDiameterChange = useFunction((value: number | undefined) => {
      if (!isNil(value) && value > 0) {
        store.setUtilityRouteDiameter(route.id, value);
      }
    });
    const handleEnterEditMode = useFunction(() =>
      store.openEditorDoor({
        target: { kind: 'utilityRoute', routeId: route.id },
        aimAt: undefined,
      })
    );

    return (
      <div className="flex flex-col gap-2">
        <PropertyRow label={labels.systemLabel} isControlStretched>
          <RadioGroup
            value={route.system}
            options={TRENCH_SYSTEM_OPTIONS}
            onChange={handleSystemChange}
          />
        </PropertyRow>
        {route.system === 'sewer' ? (
          <PropertyField
            label={labels.diameter}
            value={routeDiameterMeters(route)}
            decimal={METER_DECIMALS}
            onValueChange={handleDiameterChange}
          />
        ) : undefined}
        <PropertyRow label={labels.length}>
          <PropertyValue
            value={formatMeters(routeLengthMeters(route.points), sitePlannerT.plan.meterUnit)}
          />
        </PropertyRow>
        {isNil(profile) ? undefined : (
          <PropertyRow label={labels.depthRange}>
            <PropertyValue
              value={`${profile.minDepthMeters.toFixed(TRENCH_DEPTH_DECIMALS)}–${profile.maxDepthMeters.toFixed(TRENCH_DEPTH_DECIMALS)} ${sitePlannerT.plan.meterUnit}`}
            />
          </PropertyRow>
        )}
        {isNil(profile?.slope) ? undefined : (
          <PropertyRow label={labels.slope}>
            <PropertyValue
              value={`${(profile.slope * SLOPE_CM_PER_METER).toFixed(SLOPE_DECIMALS)} ${labels.slopeUnit}`}
            />
          </PropertyRow>
        )}
        {isEditingThisRoute ? (
          <PanelHint>{labels.pointsHint}</PanelHint>
        ) : (
          <Button variant="secondary" size="sm" onClick={handleEnterEditMode}>
            <PencilRuler size={EDIT_ICON_SIZE_PX} aria-hidden />
            {sitePlannerT.modes.editRoute}
          </Button>
        )}
      </div>
    );
  }
);

/** With the trench tool in hand, the panel is where the system is armed. */
const UtilityToolProperties = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const labels = sitePlannerT.utilities;

  const handleSystemChange = useFunction((value: string) => {
    const system = parseTrenchSystem(value);

    if (!isNil(system)) {
      store.setNextUtilitySystem(system);
    }
  });

  return (
    <div className="flex flex-col gap-2">
      <PropertyRow label={labels.systemLabel} isControlStretched>
        <RadioGroup
          value={store.nextUtilitySystem}
          options={TRENCH_SYSTEM_OPTIONS}
          onChange={handleSystemChange}
        />
      </PropertyRow>
      <PanelHint>{sitePlannerT.status.hints.utility}</PanelHint>
    </div>
  );
});

/** With the electric tool in hand, the panel is where the device kind is armed. */
const ElectricToolProperties = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const labels = sitePlannerT.electrical;

  const handleKindChange = useFunction((value: string) => {
    const kind = parseDeviceKind(value);

    if (!isNil(kind)) {
      store.setArmedDeviceKind(kind);
    }
  });

  return (
    <div className="flex flex-col gap-2">
      <PropertyRow label={labels.armedLabel} isControlStretched>
        <RadioGroup
          value={store.armedDeviceKind}
          options={DEVICE_KIND_OPTIONS}
          onChange={handleKindChange}
        />
      </PropertyRow>
      <PanelHint>{labels.toolHint}</PanelHint>
    </div>
  );
});

/** With the opening tool in hand, the panel is where the preset is armed. */
const OpeningToolProperties = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const labels = sitePlannerT.openings;

  const handlePresetChange = useFunction((value: string) => {
    const preset = parseOpeningPreset(value);

    if (!isNil(preset)) {
      store.setArmedOpeningPreset(preset);
    }
  });

  return (
    <div className="flex flex-col gap-2">
      <PropertyRow label={labels.presetLabel} isControlStretched>
        <RadioGroup
          value={store.armedOpeningPreset}
          options={OPENING_PRESET_OPTIONS}
          onChange={handlePresetChange}
        />
      </PropertyRow>
      <PanelHint>{labels.toolHint}</PanelHint>
    </div>
  );
});

/**
 * A wall opened inside the building editor: its construction is data — the
 * material and reference line switch, the thickness types, and the body
 * re-derives (`building-editor.md` §4).
 */
const SelectedWallProperties = observer(
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
const SelectedBuildingProperties = observer(
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

/**
 * The keyboard path of R20: exact numbers for whatever the canvas has selected.
 */
const SelectionProperties = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const { selectedMark, selectedTree, selectedCar, selectedPath, selectedGroupTerm } = store;
  const { selectedBuilding, selectedWall, selectedOpening, selectedFurniture } = store;
  const { selectedDevice, selectedUtilityRoute } = store;

  if (store.activeTool === 'building:opening') {
    return <OpeningToolProperties store={store} />;
  }

  if (store.activeTool === 'utility' && isNil(selectedUtilityRoute)) {
    return <UtilityToolProperties store={store} />;
  }

  if (store.activeTool === 'building:electric') {
    return <ElectricToolProperties store={store} />;
  }

  if (store.activeTool === 'building:connect') {
    return <PanelHint>{sitePlannerT.electrical.connectHint}</PanelHint>;
  }

  if (!isNil(selectedDevice)) {
    return <SelectedDeviceProperties store={store} device={selectedDevice} />;
  }

  if (!isNil(selectedUtilityRoute)) {
    return <SelectedUtilityRouteProperties store={store} route={selectedUtilityRoute} />;
  }

  if (!isNil(selectedFurniture)) {
    return <SelectedFurnitureProperties store={store} furniture={selectedFurniture} />;
  }

  if (!isNil(selectedOpening)) {
    return <SelectedOpeningProperties store={store} opening={selectedOpening} />;
  }

  if (!isNil(selectedWall)) {
    return <SelectedWallProperties store={store} wall={selectedWall} />;
  }

  if (!isNil(selectedBuilding)) {
    return <SelectedBuildingProperties store={store} building={selectedBuilding} />;
  }

  if (!isNil(selectedMark)) {
    return <SelectedMarkProperties store={store} mark={selectedMark} />;
  }

  if (!isNil(selectedTree)) {
    return <SelectedTreeProperties store={store} tree={selectedTree} />;
  }

  if (!isNil(selectedCar)) {
    return <SelectedCarProperties store={store} car={selectedCar} />;
  }

  if (!isNil(selectedPath)) {
    return <SelectedPathProperties store={store} path={selectedPath} />;
  }

  if (!isNil(selectedGroupTerm)) {
    return <SelectedGroupProperties store={store} groupTerm={selectedGroupTerm} />;
  }

  // Shapes last: with nothing selected at all, this is what shows the hint for
  // the tool in hand.
  return <SelectedShapeProperties store={store} />;
});

export const PropertiesPanel = observer(({ store }: { readonly store: SitePlannerStore }) => (
  <PlannerPanel title={sitePlannerT.properties.title}>
    <SelectionProperties store={store} />
  </PlannerPanel>
));
