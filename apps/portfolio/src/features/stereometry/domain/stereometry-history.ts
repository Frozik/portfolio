import type { SceneState } from './stereometry-types';

const MAX_HISTORY_SIZE = 100;

export interface SceneHistory {
  push(state: SceneState): void;
  undo(currentState: SceneState): SceneState | undefined;
  redo(currentState: SceneState): SceneState | undefined;
  canUndo(): boolean;
  canRedo(): boolean;
}

/**
 * Creates an undo/redo history manager for scene states.
 * Pushing a new state clears the redo stack.
 * Undo/redo require the current state so it can be saved to the opposite stack.
 */
export function createSceneHistory(): SceneHistory {
  const undoStack: SceneState[] = [];
  const redoStack: SceneState[] = [];

  return {
    push(state: SceneState): void {
      undoStack.push(state);
      redoStack.length = 0;

      if (undoStack.length > MAX_HISTORY_SIZE) {
        undoStack.shift();
      }
    },

    undo(currentState: SceneState): SceneState | undefined {
      const previousState = undoStack.pop();

      if (previousState === undefined) {
        return undefined;
      }

      redoStack.push(currentState);
      return previousState;
    },

    redo(currentState: SceneState): SceneState | undefined {
      const nextState = redoStack.pop();

      if (nextState === undefined) {
        return undefined;
      }

      undoStack.push(currentState);
      return nextState;
    },

    canUndo(): boolean {
      return undoStack.length > 0;
    },

    canRedo(): boolean {
      return redoStack.length > 0;
    },
  };
}
