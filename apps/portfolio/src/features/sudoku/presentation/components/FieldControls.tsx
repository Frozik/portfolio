import { useFunction } from '@frozik/components';
import { isNil } from 'lodash-es';
import { PenTool, Trash2, Undo, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../../../shared/lib/cn';
import { getIndexesArray, getPairs, getUsedNumbers, hasMarks } from '../../domain/services';
import type { IField, TTool } from '../../domain/types';
import { EToolType } from '../../domain/types';
import styles from './styles.module.scss';

const ICON_SCALE = 0.6;
const FONT_SCALE = 0.8;
const NOTE_ICON_SCALE = 0.8;
const THIRD_DIVISOR = 3;

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
    <div className={styles.controls}>
      {getIndexesArray(field.size).map(index => {
        const offset = index * field.size;

        return (
          <div
            key={index}
            className={styles.fieldGroup}
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
                  className={cn(styles.controlItem, {
                    [styles.controlItemSelected]: toolValue === tool.value,
                  })}
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
        className={styles.fieldGroup}
        style={{
          ...baseStyle,
          gridTemplateColumns: `repeat(${field.size}, ${cellSize}px)`,
          gridColumn: 1,
          gridRow: 2,
        }}
      >
        <div
          className={styles.controlItem}
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
              className={styles.controlItem}
              style={{
                ...baseStyle,
                gridColumn: 2,
              }}
              onClick={onRestartGame}
            >
              <Trash2 size={Math.trunc(cellSize * ICON_SCALE)} />
            </div>
            <div
              className={styles.controlItem}
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
        className={styles.fieldGroup}
        style={{
          ...baseStyle,
          gridTemplateColumns: `repeat(${field.size}, ${cellSize}px)`,
          gridColumn: field.size,
          gridRow: 2,
        }}
      >
        <div
          className={cn(styles.controlItem, {
            [styles.controlItemSelected]: toolType === EToolType.Pen,
          })}
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
          className={cn(styles.controlItem, styles.controlItemNotes, {
            [styles.controlItemSelected]: marksSelected,
          })}
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
