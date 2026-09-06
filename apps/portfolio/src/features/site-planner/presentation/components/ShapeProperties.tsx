import type { IRichEditorHandle } from '@frozik/components/components/RichEditor/defs';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil, round } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import type { RefObject } from 'react';
import { memo, useEffect, useRef } from 'react';

import { RadioGroup } from '../../../../shared/ui/RadioGroup';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import {
  anchorPlanPosition,
  moveShapeByAnchor,
  rotateRectangleAroundAnchor,
} from '../../domain/geometry/shape-anchor';
import type { BoxedShape, CircleShape, GroupTerm, Shape } from '../../domain/model/shapes';
import { flattenShapes } from '../../domain/model/shapes';
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
import { describePlacedObject } from './placedObjectLabel';
import { PropertyField } from './PropertyField';
import { PropertyRow, PropertyValue } from './PropertyRow';
import { toolHint } from './toolHints';

/** Which of the shape's numbers an edit came from — the history groups by it. */
type ShapeField = 'center-x' | 'center-y' | 'width' | 'length' | 'rotation' | 'radius';

/**
 * The field a freshly drawn shape hands the keyboard to: its first dimension,
 * which is the width of a rectangle and the radius of a circle.
 */
type SizeFieldRef = RefObject<IRichEditorHandle | null>;

type ShapeFieldChange = (shape: Shape, field: ShapeField) => void;

/** Millimetre precision: enough for any plan reading, none of the float tails. */
const ANCHOR_DISPLAY_DECIMALS = 3;

/** A group has no dimensions of its own — only how it joins the fold above it. */
const OPERATION_OPTIONS = [
  { value: 'union', label: sitePlannerT.structure.union },
  { value: 'subtract', label: sitePlannerT.structure.subtract },
];

const BoxedShapeProperties = memo(
  ({
    shape,
    sizeFieldRef,
    onChange,
  }: {
    readonly shape: BoxedShape;
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

/**
 * What the panel shows with nothing selected: the hint for the tool in hand,
 * and — while that tool places objects — what it is armed with. The choosing
 * itself belongs to the tool button's flyout, where the tool is picked up.
 */
const EmptyProperties = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const { activeTool } = store;

  if (activeTool === PLACED_OBJECT_TOOL) {
    const armedObject = store.siteObjects.nextPlacedObject;

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

/**
 * A selected group: how it joins the fold that holds it, and how much it holds.
 * There is nothing else to type for it — a group has no geometry of its own, and
 * the shapes it folds are edited one by one through the structure panel.
 */
export const SelectedGroupProperties = observer(
  ({ store, groupTerm }: { readonly store: SitePlannerStore; readonly groupTerm: GroupTerm }) => {
    const { selection } = store;
    const { group, operation } = groupTerm;

    const handleOperationChange = useFunction((value: string) => {
      if (value !== operation && !isNil(selection) && selection.kind === 'group') {
        store.composition.toggleTermOperation(selection.owner, group.id);
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

export const SelectedShapeProperties = observer(
  ({ store }: { readonly store: SitePlannerStore }) => {
    const shape = store.composition.selectedShape;
    const { isPropertiesFocusPending } = store.tooling;
    const sizeFieldRef = useRef<IRichEditorHandle>(null);
    // Typing a number arrives one keystroke at a time; the field the keystrokes
    // belong to is what collapses them into a single step to undo.
    const handleChange = useFunction((nextShape: Shape, field: ShapeField) => {
      store.pushHistory(`${nextShape.id}:${field}`);
      store.composition.updateSelectedShape(nextShape);
    });

    // A shape just drawn with the pointer asks for the keyboard, so its rough
    // dimension can be replaced by the surveyed one without reaching for the
    // mouse again.
    useEffect(() => {
      if (!isPropertiesFocusPending) {
        return;
      }

      store.tooling.consumePropertiesFocus();
      sizeFieldRef.current?.focus();
    }, [store, isPropertiesFocusPending]);

    if (isNil(shape)) {
      return <EmptyProperties store={store} />;
    }

    switch (shape.kind) {
      // A rectangle and an ellipse are stated by the same box: two extents and
      // a turn, so they are typed in the same four fields.
      case 'rectangle':
      case 'ellipse':
        return (
          <BoxedShapeProperties shape={shape} sizeFieldRef={sizeFieldRef} onChange={handleChange} />
        );
      case 'circle':
        return (
          <CircleProperties shape={shape} sizeFieldRef={sizeFieldRef} onChange={handleChange} />
        );
      default:
        return assertNever(shape);
    }
  }
);
