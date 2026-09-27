import { observer } from 'mobx-react-lite';
import type { ComponentType } from 'react';
import { useRef } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { assert } from '@frozik/utils/assert/assert';

import type { IDetailRowsSlice } from '../../../extensions/detail-rows/core';
import type { IRowContext } from '../../column';
import { gridViewOf } from '../../grid/gridViewOf';
import { useRowMeasure } from '../../grid/useRowMeasure';

/** The detail under an open row: as wide as the viewport, sticky against horizontal scroll, measured when the height is `auto`. */
export function detailRowFor<TRow>(Detail: ComponentType<IRowContext<TRow>>) {
  return observer(function DetailRow(context: IRowContext<TRow>) {
    const { table, displayRow } = context;
    const slice = table.extension<IDetailRowsSlice>('detailRows');
    assert(slice !== undefined, 'DetailRow renders only with the detailRows extension');
    const elementRef = useRef<HTMLDivElement>(null);
    const measure = useEventCallback((height: number) => slice.measure(displayRow.key, height));
    const expanded = slice.isExpanded(displayRow.key);
    useRowMeasure(elementRef, expanded && slice.measures, measure);
    if (!expanded) {
      return null;
    }
    const width = gridViewOf(table).viewport.width;
    return (
      <div
        ref={elementRef}
        className="ft-detail"
        role="row"
        style={{
          width: width === undefined ? undefined : `${width}px`,
          height: slice.measures ? undefined : `${slice.extentOf(displayRow.key)}px`,
        }}
      >
        <div role="gridcell" className="ft-detail-body">
          <Detail {...context} />
        </div>
      </div>
    );
  });
}
