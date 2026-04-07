import { useFunction } from '@frozik/components';
import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { useResizeObserver } from 'usehooks-ts';
import { cn } from '../../../../shared/lib/cn';
import { puzzleSolved } from '../../domain/services';
import type { IField, TTool } from '../../domain/types';
import { FieldControls } from './FieldControls';
import { FieldGroups } from './FieldGroups';
import styles from './styles.module.scss';

const CONTROL_LINES = 2;

export function SudokuField({
  field,
  tool,
  hasHistory,
  onRestorePreviousState,
  onClickCell,
  onChangeTool,
  onMarkField,
  onExitGame,
  onRestartGame,
}: {
  field: IField;
  tool: TTool;
  hasHistory: boolean;
  onRestorePreviousState: VoidFunction;
  onClickCell: (row: number, column: number) => void;
  onChangeTool: (tool: TTool) => void;
  onMarkField: VoidFunction;
  onExitGame: VoidFunction;
  onRestartGame: VoidFunction;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { width = 0, height = 0 } = useResizeObserver({
    ref: ref as React.RefObject<HTMLElement>,
    box: 'border-box',
  });

  const cellGap = Number.parseInt(styles.varFieldGroupGap, 10);
  const groupGap = Number.parseInt(styles.varFieldGap, 10);
  const fieldControlsMargin = Number.parseInt(styles.varFieldControlsMargin, 10);

  const totalGap = (field.size - 1) * field.size * cellGap + (field.size + 1) * groupGap;
  const controlsGap = fieldControlsMargin + (CONTROL_LINES + 1) * groupGap;

  const cellWidth = width - totalGap;
  const cellHeight = height - totalGap - controlsGap;

  const cellSize = Math.floor(
    Math.min(cellWidth / field.size ** 2, cellHeight / (field.size ** 2 + CONTROL_LINES))
  );
  const groupSize = cellSize * field.size + (field.size - 1) * cellGap;
  const size = cellSize * field.size ** 2 + totalGap;

  const fieldGridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${field.size}, ${groupSize}px)`,
      gridTemplateRows: `repeat(${field.size}, ${groupSize}px)`,
      maxWidth: `${size}px`,
      maxHeight: `${size}px`,
    }),
    [field.size, groupSize, size]
  );

  const groupGridStyle = useMemo(
    () => ({
      gridTemplateColumns: `repeat(${field.size}, ${cellSize}px)`,
      gridTemplateRows: `repeat(${field.size}, ${cellSize}px)`,
    }),
    [field.size, cellSize]
  );

  const [selectedCell, setSelectedCell] = useState<{ row: number; column: number } | undefined>(
    undefined
  );

  const handleOverCell = useFunction((row: number, column: number) =>
    setSelectedCell({ row, column })
  );
  const handleOutCell = useFunction(() => setSelectedCell(undefined));

  const completed = puzzleSolved(field);

  return (
    <div ref={ref} className={styles.fieldContainer}>
      <div
        className={cn(styles.field, { [styles.fieldCompleted]: completed })}
        style={fieldGridStyle}
        onMouseOut={handleOutCell}
      >
        <FieldGroups
          field={field}
          groupGridStyle={groupGridStyle}
          cellSize={cellSize}
          selectedCell={selectedCell}
          tool={tool}
          onOverCell={handleOverCell}
          onClickCell={onClickCell}
        />
      </div>
      <FieldControls
        field={field}
        cellSize={cellSize}
        tool={tool}
        hasHistory={hasHistory}
        onRestorePreviousState={onRestorePreviousState}
        onChangeTool={onChangeTool}
        onMarkField={onMarkField}
        onExitGame={onExitGame}
        onRestartGame={onRestartGame}
      />
    </div>
  );
}
