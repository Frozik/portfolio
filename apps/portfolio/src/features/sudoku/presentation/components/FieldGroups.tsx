import { observer } from 'mobx-react-lite';
import type { CSSProperties } from 'react';

import { getPairs } from '../../domain/services';
import type { IField, ITool } from '../../domain/types';
import { FieldCell } from './FieldCell';

export const FieldGroups = observer(
  ({
    field,
    groupGridStyle,
    cellSize,
    selectedCell,
    tool,
    onOverCell,
    onClickCell,
  }: {
    readonly field: IField;
    readonly groupGridStyle: CSSProperties;
    readonly cellSize: number;
    readonly selectedCell: { readonly row: number; readonly column: number } | undefined;
    readonly tool: ITool;
    readonly onOverCell: (row: number, column: number) => void;
    readonly onClickCell: (row: number, column: number) => void;
  }) =>
    getPairs(field.size).map(([groupRow, groupColumn]) => (
      <div
        key={`${groupRow}:${groupColumn}`}
        className="grid gap-px"
        style={{ ...groupGridStyle, gridColumn: groupColumn + 1, gridRow: groupRow + 1 }}
      >
        {getPairs(field.size).map(([cellRow, cellColumn]) => (
          <FieldCell
            key={`${cellRow}:${cellColumn}`}
            field={field}
            groupRow={groupRow}
            groupColumn={groupColumn}
            cellRow={cellRow}
            cellColumn={cellColumn}
            cellSize={cellSize}
            selectedCell={selectedCell}
            tool={tool}
            onOverCell={onOverCell}
            onClickCell={onClickCell}
          />
        ))}
      </div>
    ))
);
