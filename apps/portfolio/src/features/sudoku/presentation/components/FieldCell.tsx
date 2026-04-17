import { useFunction } from '@frozik/components';
import { isEmpty, isNil } from 'lodash-es';
import { cn } from '../../../../shared/lib/cn';
import { getPairs } from '../../domain/services';
import type { IField, TTool } from '../../domain/types';
import { ECellStatus, EFieldType } from '../../domain/types';

/** Text-shadow glow reused for highlighted / wrong cell states */
const CELL_GLOW_CLASS = '[text-shadow:0_0_10px_#000]';
const NOTE_GLOW_CLASS = '[text-shadow:0_0_5px_#000]';

export function FieldCell({
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
}) {
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
        'flex bg-neutral-700',
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
      {isNil(cell.value)
        ? getPairs(field.size).map(([row, column], index) => {
            const noteValue = index + 1;

            return (
              <div
                key={noteValue}
                className={cn(noteValue === tool.value && `text-blue-600 ${NOTE_GLOW_CLASS}`)}
                style={{
                  gridColumn: column + 1,
                  gridRow: row + 1,
                }}
              >
                {notes.includes(noteValue) ? noteValue : undefined}
              </div>
            );
          })
        : value}
    </div>
  );
}
