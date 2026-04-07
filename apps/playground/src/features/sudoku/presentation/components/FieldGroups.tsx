import type { CSSProperties } from 'react';
import { getPairs } from '../../domain/services';
import type { IField, TTool } from '../../domain/types';
import { FieldCell } from './FieldCell';
import styles from './styles.module.scss';

export function FieldGroups({
  field,
  groupGridStyle,
  cellSize,
  selectedCell,
  tool,
  onOverCell,
  onClickCell,
}: {
  field: IField;
  groupGridStyle: CSSProperties;
  cellSize: number;
  selectedCell: { row: number; column: number } | undefined;
  tool: TTool;
  onOverCell: (row: number, column: number) => void;
  onClickCell: (row: number, column: number) => void;
}) {
  return getPairs(field.size).map(([groupRow, groupColumn]) => (
    <div
      key={`${groupRow}:${groupColumn}`}
      className={styles.fieldGroup}
      style={{
        ...groupGridStyle,
        gridColumn: groupColumn + 1,
        gridRow: groupRow + 1,
      }}
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
  ));
}
