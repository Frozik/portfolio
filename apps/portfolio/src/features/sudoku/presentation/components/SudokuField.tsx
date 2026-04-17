import { useFunction } from '@frozik/components';
import type React from 'react';
import { useMemo, useRef, useState } from 'react';
import { useResizeObserver } from 'usehooks-ts';
import { cn } from '../../../../shared/lib/cn';
import { puzzleSolved } from '../../domain/services';
import type { IField, TTool } from '../../domain/types';
import { FIELD_CONTROLS_MARGIN_PX, FIELD_GAP_PX, FIELD_GROUP_GAP_PX } from '../layout-constants';
import { FieldControls } from './FieldControls';
import { FieldGroups } from './FieldGroups';

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

  const totalGap =
    (field.size - 1) * field.size * FIELD_GROUP_GAP_PX + (field.size + 1) * FIELD_GAP_PX;
  const controlsGap = FIELD_CONTROLS_MARGIN_PX + (CONTROL_LINES + 1) * FIELD_GAP_PX;

  const cellWidth = width - totalGap;
  const cellHeight = height - totalGap - controlsGap;

  const cellSize = Math.floor(
    Math.min(cellWidth / field.size ** 2, cellHeight / (field.size ** 2 + CONTROL_LINES))
  );
  const groupSize = cellSize * field.size + (field.size - 1) * FIELD_GROUP_GAP_PX;
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
    <div ref={ref} className="flex size-full flex-col items-center justify-center">
      <div
        className={cn(
          'inline-grid select-none gap-1 overflow-hidden bg-neutral-900 p-1',
          completed && 'bg-green-400/50'
        )}
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
