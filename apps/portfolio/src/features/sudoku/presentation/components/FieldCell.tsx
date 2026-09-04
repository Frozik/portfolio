import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isEmpty, isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';

import { cellAt } from '../../domain/services';
import type { IField, ITool } from '../../domain/types';
import { ECellStatus, EFieldType } from '../../domain/types';

const CELL_GLOW_CLASS = '[text-shadow:0_0_10px_#000]';
const NOTE_GLOW_CLASS = '[text-shadow:0_0_5px_#000]';

export const FieldCell = observer(
  ({
    field,
    groupRow,
    groupColumn,
    cellRow,
    cellColumn,
    cellSize,
    selectedCell,
    tool,
    onOverCell,
    onClickCell,
  }: {
    readonly field: IField;
    readonly groupRow: number;
    readonly groupColumn: number;
    readonly cellRow: number;
    readonly cellColumn: number;
    readonly cellSize: number;
    readonly selectedCell: { readonly row: number; readonly column: number } | undefined;
    readonly tool: ITool;
    readonly onOverCell: (row: number, column: number) => void;
    readonly onClickCell: (row: number, column: number) => void;
  }) => {
    const globalRow = groupRow * field.size + cellRow;
    const globalColumn = groupColumn * field.size + cellColumn;
    const { type, value, notes, status } = cellAt(field, globalRow, globalColumn);

    const hasValue = !isNil(value);
    const hasNotes = !isEmpty(notes);
    const noteSize = Math.floor(cellSize / field.size);
    const showsNotes = !hasValue && hasNotes;

    const handleMouseOver = useFunction(() => onOverCell(globalRow, globalColumn));
    const handleClick = useFunction(() => onClickCell(globalRow, globalColumn));

    const isFixed = type === EFieldType.Fixed;
    const isWrong = status === ECellStatus.Wrong;
    const isHighlighted = hasValue && value === tool.value;
    const isRowOrColumnHovered =
      selectedCell?.row === globalRow || selectedCell?.column === globalColumn;

    return (
      <div
        data-hover-row-column={isRowOrColumnHovered || undefined}
        className={cn(
          // `min-w-0 min-h-0 overflow-hidden leading-none` keep a filled cell inside its
          // track; otherwise its line box overlaps the neighbour and steals its clicks.
          'flex min-h-0 min-w-0 overflow-hidden bg-neutral-700 leading-none',
          isFixed ? 'cursor-not-allowed text-neutral-300' : 'cursor-pointer text-neutral-500',
          hasValue && 'items-center justify-center',
          showsNotes && 'grid place-items-center',
          isHighlighted && (isFixed ? 'font-bold text-blue-500' : 'font-bold text-blue-600'),
          isWrong && (isFixed ? 'text-red-500' : 'text-red-300'),
          (isHighlighted || isWrong) && CELL_GLOW_CLASS
        )}
        style={{
          fontSize: `${showsNotes ? noteSize : cellSize}px`,
          gridColumn: cellColumn + 1,
          gridRow: cellRow + 1,
          ...(showsNotes
            ? {
                gridTemplateColumns: `repeat(${field.size}, ${noteSize}px)`,
                gridTemplateRows: `repeat(${field.size}, ${noteSize}px)`,
              }
            : {}),
        }}
        onMouseOver={handleMouseOver}
        onClick={handleClick}
      >
        {hasValue
          ? value
          : showsNotes &&
            notes.map(noteValue => {
              const noteIndex = noteValue - 1;
              return (
                <div
                  key={noteValue}
                  className={cn(noteValue === tool.value && `text-blue-600 ${NOTE_GLOW_CLASS}`)}
                  style={{
                    gridColumn: (noteIndex % field.size) + 1,
                    gridRow: Math.floor(noteIndex / field.size) + 1,
                  }}
                >
                  {noteValue}
                </div>
              );
            })}
      </div>
    );
  }
);
