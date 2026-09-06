import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { memo } from 'react';

import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { ElevationMark } from '../../domain/model/site-plan';
import { METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import { PropertyField } from './PropertyField';

/** The properties of a survey mark: where it stands and the elevation it records. */
/** The same grouping for a mark: a typed elevation is one step, not five. */
type MarkField = 'position-x' | 'position-y' | 'elevation';

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

export const SelectedMarkProperties = observer(
  ({ store, mark }: { readonly store: SitePlannerStore; readonly mark: ElevationMark }) => {
    const handleChange = useFunction((nextMark: ElevationMark, field: MarkField) => {
      store.pushHistory(`${nextMark.id}:${field}`);

      if (field === 'elevation') {
        store.marks.setElevationMarkElevation(nextMark.id, nextMark.elevation);

        return;
      }

      store.marks.moveElevationMark(nextMark.id, nextMark.position);
    });

    return <MarkProperties mark={mark} onChange={handleChange} />;
  }
);
