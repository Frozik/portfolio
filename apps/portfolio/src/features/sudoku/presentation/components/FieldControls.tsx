import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { LayoutGrid, PenTool, Trash2, Undo } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { CSSProperties } from 'react';
import { memo, useMemo, useState } from 'react';
import { getIndexesArray, getPairs, getUsedNumbers, hasMarks } from '../../domain/services';
import type { IField, TTool } from '../../domain/types';
import { EToolType } from '../../domain/types';
import { sudokuT } from '../translations';

const ICON_SCALE = 0.6;
const FONT_SCALE = 0.8;
const NOTE_ICON_SCALE = 0.8;
const THIRD_DIVISOR = 3;

const CONTROL_ITEM_BASE_CLASS =
  'relative flex items-center justify-center bg-neutral-500 text-black hover:shadow-[1px_1px_1px_#f5f5f5,-1px_-1px_1px_#f5f5f5]';

const CONTROL_ITEM_SELECTED_CLASS = 'bg-neutral-300';

/** Pseudo-element showing how many times this number is already placed on the field. */
const USAGE_BADGE_CLASS =
  'after:absolute after:right-0.5 after:top-0.5 after:text-[40%] after:content-[attr(data-used)] after:[text-shadow:0_0_5px_#fff,0_0_10px_#fff]';

export const FieldControls = observer(
  ({
    field,
    tool,
    cellSize,
    hasHistory,
    onRestorePreviousState,
    onChangeTool,
    onMarkField,
    onExitGame,
    onRestartGame,
  }: {
    field: IField;
    cellSize: number;
    tool: TTool;
    hasHistory: boolean;
    onRestorePreviousState: VoidFunction;
    onChangeTool: (tool: TTool) => void;
    onMarkField: VoidFunction;
    onExitGame: VoidFunction;
    onRestartGame: VoidFunction;
  }) => {
    // The store drops the tool to `None` whenever no number is selected, so the
    // pen/notes mode has to outlive it locally — while a number is selected the
    // store stays the single source of truth.
    const [preferredToolType, setPreferredToolType] = useState<EToolType.Pen | EToolType.Notes>(
      EToolType.Pen
    );

    const toolType = tool.type === EToolType.None ? preferredToolType : tool.type;

    const handleSelectToolValue = useFunction((value: number) =>
      onChangeTool({ type: toolType, value })
    );

    const handleToggleToolType = useFunction(() => {
      const nextToolType = toolType === EToolType.Pen ? EToolType.Notes : EToolType.Pen;

      setPreferredToolType(nextToolType);

      if (!isNil(tool.value)) {
        onChangeTool({ type: nextToolType, value: tool.value });
      }
    });

    const usedNumbersMap = getUsedNumbers(field);

    const baseStyle = useMemo(
      () => ({
        width: cellSize,
        height: cellSize,
        fontSize: Math.trunc(cellSize * FONT_SCALE),
      }),
      [cellSize]
    );

    const thirdCellSize = Math.trunc(cellSize / THIRD_DIVISOR);
    const iconSize = Math.trunc(cellSize * ICON_SCALE);

    const marksSelected = hasMarks(field);
    const penSelected = toolType === EToolType.Pen;

    return (
      <div className="mt-2.5 inline-grid select-none gap-1 overflow-hidden bg-neutral-900 p-1">
        {getIndexesArray(field.size).map(groupIndex => (
          <div
            key={groupIndex}
            className="grid gap-px"
            style={{
              gridTemplateColumns: `repeat(${field.size}, ${cellSize}px)`,
              gridColumn: groupIndex + 1,
              gridRow: 1,
            }}
          >
            {getIndexesArray(field.size).map(valueIndex => {
              const toolValue = groupIndex * field.size + valueIndex + 1;

              return (
                <ToolValueButton
                  key={toolValue}
                  value={toolValue}
                  usedCount={usedNumbersMap.get(toolValue) ?? 0}
                  selected={toolValue === tool.value}
                  style={baseStyle}
                  onSelect={handleSelectToolValue}
                />
              );
            })}
          </div>
        ))}

        <div
          className="grid gap-px"
          style={{
            ...baseStyle,
            gridTemplateColumns: `repeat(${field.size}, ${cellSize}px)`,
            gridColumn: 1,
            gridRow: 2,
          }}
        >
          <button
            type="button"
            aria-label={sudokuT.nav.backToDifficultyLabel}
            className={CONTROL_ITEM_BASE_CLASS}
            style={{
              ...baseStyle,
              gridColumn: 1,
            }}
            onClick={onExitGame}
          >
            <LayoutGrid size={iconSize} fill="currentColor" />
          </button>

          {hasHistory && (
            <>
              <button
                type="button"
                aria-label={sudokuT.controls.restartPuzzle}
                className={CONTROL_ITEM_BASE_CLASS}
                style={{
                  ...baseStyle,
                  gridColumn: 2,
                }}
                onClick={onRestartGame}
              >
                <Trash2 size={iconSize} />
              </button>
              <button
                type="button"
                aria-label={sudokuT.controls.undoLastMove}
                className={CONTROL_ITEM_BASE_CLASS}
                style={{
                  ...baseStyle,
                  gridColumn: 3,
                }}
                onClick={onRestorePreviousState}
              >
                <Undo size={iconSize} />
              </button>
            </>
          )}
        </div>

        <div
          className="grid gap-px"
          style={{
            ...baseStyle,
            gridTemplateColumns: `repeat(${field.size}, ${cellSize}px)`,
            gridColumn: field.size,
            gridRow: 2,
          }}
        >
          <button
            type="button"
            aria-label={sudokuT.controls.penMode}
            aria-pressed={penSelected}
            className={cn(CONTROL_ITEM_BASE_CLASS, penSelected && CONTROL_ITEM_SELECTED_CLASS)}
            style={{
              width: cellSize,
              height: cellSize,
              gridColumn: field.size - 1,
            }}
            onClick={handleToggleToolType}
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
              <span
                key={`${row}-${column}`}
                style={{
                  gridColumn: column + 1,
                  gridRow: row + 1,
                }}
              >
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
        // The usage badge is a `::after` pseudo-element whose text would otherwise
        // leak into the computed accessible name of the button.
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
