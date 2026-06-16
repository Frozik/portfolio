import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isEmpty, isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import type { IField, TTool } from '../../domain/types';
import { ECellStatus, EFieldType } from '../../domain/types';

/** Text-shadow glow reused for highlighted / wrong cell states */
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
    field: IField;
    groupRow: number;
    groupColumn: number;
    cellRow: number;
    cellColumn: number;
    cellSize: number;
    selectedCell: { row: number; column: number } | undefined;
    tool: TTool;
    onOverCell: (row: number, column: number) => void;
    onClickCell: (row: number, column: number) => void;
  }) => {
    const globalRow = groupRow * field.size + cellRow;
    const globalColumn = groupColumn * field.size + cellColumn;

    const cellIndex = globalRow * field.size ** 2 + globalColumn;

    const cell = field.cells[cellIndex];

    const { type, value, notes, status } = cell;

    const hasValue = !isNil(value);
    const hasNotes = !isEmpty(notes);

    const noteSize = Math.floor(cellSize / field.size);

    const noteGridStyle =
      !hasValue && hasNotes
        ? {
            gridTemplateColumns: `repeat(${field.size}, ${noteSize}px)`,
            gridTemplateRows: `repeat(${field.size}, ${noteSize}px)`,
          }
        : undefined;

    const handleMouseOver = useFunction(() => onOverCell(globalRow, globalColumn));
    const handleClick = useFunction(() => onClickCell(globalRow, globalColumn));

    const isFixed = type === EFieldType.Fixed;
    const isWrong = status === ECellStatus.Wrong;
    const isHighlighted = hasValue && value === tool.value;
    const isRowOrColumnHovered =
      selectedCell?.row === globalRow || selectedCell?.column === globalColumn;

    const colorClass = cn(
      isFixed ? 'text-neutral-300' : 'text-neutral-500',
      isHighlighted && (isFixed ? 'font-bold text-blue-500' : 'font-bold text-blue-600'),
      isWrong && (isFixed ? 'text-red-500' : 'text-red-300'),
      (isHighlighted || isWrong) && CELL_GLOW_CLASS
    );

    return (
      <div
        data-hover-row-column={isRowOrColumnHovered || undefined}
        className={cn(
          // `min-w-0 min-h-0 overflow-hidden leading-none` clamp the cell to its
          // grid track: without them a filled cell's text (fontSize = cellSize,
          // line-box > track) inflates the box past its track via the grid default
          // `min-height: auto`, overlapping the neighbouring cell and stealing its
          // clicks (a click meant for the empty neighbour erased the filled cell).
          'flex min-h-0 min-w-0 overflow-hidden bg-neutral-700 leading-none',
          isFixed ? 'cursor-not-allowed' : 'cursor-pointer',
          hasValue && 'items-center justify-center',
          !hasValue && hasNotes && 'grid place-items-center',
          colorClass
        )}
        style={{
          fontSize: `${hasValue || !hasNotes ? cellSize : noteSize}px`,
          gridColumn: cellColumn + 1,
          gridRow: cellRow + 1,
          ...noteGridStyle,
        }}
        onMouseOver={handleMouseOver}
        onClick={handleClick}
      >
        {hasValue
          ? value
          : hasNotes &&
            notes.map(noteValue => {
              // Note `noteValue` always occupies the same fixed grid track:
              // its 0-based index maps row-major to (row, column) within the
              // size×size note grid, identical to the previous full-placeholder
              // layout — we just skip the empty placeholders.
              const noteIndex = noteValue - 1;
              const noteRow = Math.floor(noteIndex / field.size);
              const noteColumn = noteIndex % field.size;

              return (
                <div
                  key={noteValue}
                  className={cn(noteValue === tool.value && `text-blue-600 ${NOTE_GLOW_CLASS}`)}
                  style={{
                    gridColumn: noteColumn + 1,
                    gridRow: noteRow + 1,
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
