import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { range } from 'lodash-es';
import { LayoutGrid, PenTool, Trash2, Undo } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { CSSProperties } from 'react';
import { memo, useMemo } from 'react';

import { getPairs, getUsedNumbers, hasMarks } from '../../domain/services';
import type { IField, ITool, ToolMode } from '../../domain/types';
import { sudokuT } from '../translations';

const ICON_SCALE = 0.6;
const FONT_SCALE = 0.8;
const NOTE_ICON_SCALE = 0.8;
const THIRD_DIVISOR = 3;

const CONTROL_ITEM_BASE_CLASS =
  'relative flex items-center justify-center bg-neutral-500 text-black hover:shadow-[1px_1px_1px_#f5f5f5,-1px_-1px_1px_#f5f5f5]';
const CONTROL_ITEM_SELECTED_CLASS = 'bg-neutral-300';
/** `::after` shows how many groups already hold the number; `data-used` feeds it. */
const USAGE_BADGE_CLASS =
  'after:absolute after:right-0.5 after:top-0.5 after:text-[40%] after:content-[attr(data-used)] after:[text-shadow:0_0_5px_#fff,0_0_10px_#fff]';

export const FieldControls = observer(
  ({
    field,
    tool,
    cellSize,
    hasHistory,
    onRestorePreviousState,
    onSelectToolValue,
    onSelectToolMode,
    onMarkField,
    onExitGame,
    onRestartGame,
  }: {
    readonly field: IField;
    readonly cellSize: number;
    readonly tool: ITool;
    readonly hasHistory: boolean;
    readonly onRestorePreviousState: VoidFunction;
    readonly onSelectToolValue: (value: number) => void;
    readonly onSelectToolMode: (mode: ToolMode) => void;
    readonly onMarkField: VoidFunction;
    readonly onExitGame: VoidFunction;
    readonly onRestartGame: VoidFunction;
  }) => {
    const handleToggleToolMode = useFunction(() => {
      onSelectToolMode(tool.mode === 'pen' ? 'notes' : 'pen');
    });

    const usedNumbersMap = getUsedNumbers(field);
    const cellStyle = useMemo(
      () => ({ width: cellSize, height: cellSize, fontSize: Math.trunc(cellSize * FONT_SCALE) }),
      [cellSize]
    );
    const rowStyle = useMemo(
      () => ({ ...cellStyle, gridTemplateColumns: `repeat(${field.size}, ${cellSize}px)` }),
      [cellStyle, field.size, cellSize]
    );

    const thirdCellSize = Math.trunc(cellSize / THIRD_DIVISOR);
    const iconSize = Math.trunc(cellSize * ICON_SCALE);
    const marksSelected = hasMarks(field);
    const penSelected = tool.mode === 'pen';

    return (
      <div className="mt-2.5 inline-grid select-none gap-1 overflow-hidden bg-neutral-900 p-1">
        {range(field.size).map(groupIndex => (
          <div
            key={groupIndex}
            className="row-start-1 grid gap-px"
            style={{
              gridTemplateColumns: rowStyle.gridTemplateColumns,
              gridColumn: groupIndex + 1,
            }}
          >
            {range(field.size).map(valueIndex => {
              const toolValue = groupIndex * field.size + valueIndex + 1;
              return (
                <ToolValueButton
                  key={toolValue}
                  value={toolValue}
                  usedCount={usedNumbersMap.get(toolValue) ?? 0}
                  selected={toolValue === tool.value}
                  style={cellStyle}
                  onSelect={onSelectToolValue}
                />
              );
            })}
          </div>
        ))}

        <div className="col-start-1 row-start-2 grid gap-px" style={rowStyle}>
          <button
            type="button"
            aria-label={sudokuT.nav.backToDifficultyLabel}
            className={cn(CONTROL_ITEM_BASE_CLASS, 'col-start-1')}
            style={cellStyle}
            onClick={onExitGame}
          >
            <LayoutGrid size={iconSize} fill="currentColor" />
          </button>
          {hasHistory && (
            <>
              <button
                type="button"
                aria-label={sudokuT.controls.restartPuzzle}
                className={cn(CONTROL_ITEM_BASE_CLASS, 'col-start-2')}
                style={cellStyle}
                onClick={onRestartGame}
              >
                <Trash2 size={iconSize} />
              </button>
              <button
                type="button"
                aria-label={sudokuT.controls.undoLastMove}
                className={cn(CONTROL_ITEM_BASE_CLASS, 'col-start-3')}
                style={cellStyle}
                onClick={onRestorePreviousState}
              >
                <Undo size={iconSize} />
              </button>
            </>
          )}
        </div>

        <div className="row-start-2 grid gap-px" style={{ ...rowStyle, gridColumn: field.size }}>
          <button
            type="button"
            aria-label={sudokuT.controls.penMode}
            aria-pressed={penSelected}
            className={cn(CONTROL_ITEM_BASE_CLASS, penSelected && CONTROL_ITEM_SELECTED_CLASS)}
            style={{ width: cellSize, height: cellSize, gridColumn: field.size - 1 }}
            onClick={handleToggleToolMode}
          >
            <PenTool size={penSelected ? iconSize : Math.trunc(thirdCellSize * NOTE_ICON_SCALE)} />
          </button>
          <button
            type="button"
            aria-label={sudokuT.controls.candidateMarks}
            aria-pressed={marksSelected}
            className={cn(
              CONTROL_ITEM_BASE_CLASS,
              'grid place-items-center',
              marksSelected && CONTROL_ITEM_SELECTED_CLASS
            )}
            style={{
              fontSize: `${thirdCellSize}px`,
              gridTemplateColumns: `repeat(${field.size}, ${thirdCellSize}px)`,
              gridTemplateRows: `repeat(${field.size}, ${thirdCellSize}px)`,
              gridColumn: field.size,
            }}
            onClick={onMarkField}
          >
            {getPairs(field.size).map(([row, column]) => (
              <span key={`${row}-${column}`} style={{ gridColumn: column + 1, gridRow: row + 1 }}>
                {row * field.size + column + 1}
              </span>
            ))}
          </button>
        </div>
      </div>
    );
  }
);

const ToolValueButton = memo(
  ({
    value,
    usedCount,
    selected,
    style,
    onSelect,
  }: {
    readonly value: number;
    readonly usedCount: number;
    readonly selected: boolean;
    readonly style: CSSProperties;
    readonly onSelect: (value: number) => void;
  }) => {
    const handleClick = useFunction(() => onSelect(value));
    return (
      <button
        type="button"
        // Keeps the `::after` usage badge out of the accessible name.
        aria-label={String(value)}
        aria-pressed={selected}
        className={cn(
          CONTROL_ITEM_BASE_CLASS,
          USAGE_BADGE_CLASS,
          selected && CONTROL_ITEM_SELECTED_CLASS
        )}
        style={style}
        data-used={usedCount}
        onClick={handleClick}
      >
        {value}
      </button>
    );
  }
);
