import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { PencilRuler } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';

import { Button } from '../../../../shared/ui/Button';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { editedPathId } from '../../domain/model/editor-mode';
import type { PathPoint, SitePath } from '../../domain/model/plot-objects';
import { uniformPathWidth } from '../../domain/model/plot-objects';
import { EDIT_ICON_SIZE_PX, METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PropertyField } from './PropertyField';

/** The properties of a path — its width, the door into editing it — and of the point opened inside that editor. */
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

export const SelectedPathProperties = observer(
  ({ store, path }: { readonly store: SitePlannerStore; readonly path: SitePath }) => {
    const isEditingThisPath = editedPathId(store.editorMode) === path.id;

    const handleWidthChange = useFunction((width: number) => {
      store.pushHistory(`${path.id}:width`);
      store.siteObjects.setPathWidth(path.id, width);
    });

    const handleEnterEditMode = useFunction(() =>
      store.modes.openEditorDoor({ target: { kind: 'path', pathId: path.id }, aimAt: undefined })
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
