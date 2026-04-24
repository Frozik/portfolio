import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { PenTool, Trash2, Undo, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../../../shared/lib/cn';
import { getIndexesArray, getPairs, getUsedNumbers, hasMarks } from '../../domain/services';
import type { IField, TTool } from '../../domain/types';
import { EToolType } from '../../domain/types';

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

export function FieldControls({
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
}) {
  const [toolType, setToolType] = useState<EToolType.Pen | EToolType.Notes>(
    tool.type === EToolType.None ? EToolType.Pen : tool.type
  );

  const handleToolValueChange = useFunction(event =>
    onChangeTool({
      type: toolType,
      value: Number.parseInt(event.target.dataset.value, 10),
    })
  );

  const usedNumbersMap = getUsedNumbers(field);

  const handleToggleToolType = useFunction(() => {
    const newToolType = toolType === EToolType.Pen ? EToolType.Notes : EToolType.Pen;

    setToolType(newToolType);

    if (isNil(tool.value)) {
      onChangeTool({ type: EToolType.None, value: tool.value });
    } else {
      onChangeTool({ type: newToolType, value: tool.value });
    }
  });

  const baseStyle = {
    width: cellSize,
    height: cellSize,
    fontSize: Math.trunc(cellSize * FONT_SCALE),
  };

  const thirdCellSize = Math.trunc(cellSize / THIRD_DIVISOR);

  const marksSelected = hasMarks(field);

  return (
    <div className="mt-2.5 inline-grid select-none gap-1 overflow-hidden bg-neutral-900 p-1">
      {getIndexesArray(field.size).map(index => {
        const offset = index * field.size;

        return (
          <div
            key={index}
            className="grid gap-px"
            style={{
              gridTemplateColumns: `repeat(${field.size}, ${cellSize}px)`,
              gridColumn: index + 1,
              gridRow: 1,
            }}
          >
            {getIndexesArray(field.size).map(index => {
              const toolValue = offset + index + 1;

              return (
                <div
                  key={index}
                  className={cn(
                    CONTROL_ITEM_BASE_CLASS,
                    USAGE_BADGE_CLASS,
                    toolValue === tool.value && CONTROL_ITEM_SELECTED_CLASS
                  )}
                  style={baseStyle}
                  data-value={toolValue}
                  data-used={usedNumbersMap.get(toolValue) ?? 0}
                  onClick={handleToolValueChange}
                >
                  {toolValue}
                </div>
              );
            })}
          </div>
        );
      })}

      <div
        className="grid gap-px"
        style={{
          ...baseStyle,
          gridTemplateColumns: `repeat(${field.size}, ${cellSize}px)`,
          gridColumn: 1,
          gridRow: 2,
        }}
      >
        <div
          className={CONTROL_ITEM_BASE_CLASS}
          style={{
            ...baseStyle,
            gridColumn: 1,
          }}
          onClick={onExitGame}
        >
          <Undo2 size={Math.trunc(cellSize * ICON_SCALE)} />
        </div>

        {hasHistory && (
          <>
            <div
              className={CONTROL_ITEM_BASE_CLASS}
              style={{
                ...baseStyle,
                gridColumn: 2,
              }}
              onClick={onRestartGame}
            >
              <Trash2 size={Math.trunc(cellSize * ICON_SCALE)} />
            </div>
            <div
              className={CONTROL_ITEM_BASE_CLASS}
              style={{
                ...baseStyle,
                gridColumn: 3,
              }}
              onClick={onRestorePreviousState}
            >
              <Undo size={Math.trunc(cellSize * ICON_SCALE)} />
            </div>
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
        <div
          className={cn(
            CONTROL_ITEM_BASE_CLASS,
            toolType === EToolType.Pen && CONTROL_ITEM_SELECTED_CLASS
          )}
          style={{
            width: cellSize,
            height: cellSize,
            gridColumn: field.size - 1,
          }}
          onClick={handleToggleToolType}
        >
          <PenTool
            size={Math.trunc(
              toolType === EToolType.Notes ? thirdCellSize * NOTE_ICON_SCALE : cellSize * ICON_SCALE
            )}
          />
        </div>

        <div
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
        >
          {getPairs(field.size).map(([row, column]) => (
            <div
              key={`${row}-${column}`}
              style={{
                gridColumn: column + 1,
                gridRow: row + 1,
              }}
              onClick={onMarkField}
            >
              {row * field.size + column + 1}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
