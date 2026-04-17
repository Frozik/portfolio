import type { SceneTopology } from './topology-types';

const MAX_HISTORY_SIZE = 100;

export interface SceneHistory {
  push(state: SceneTopology): void;
  undo(currentState: SceneTopology): SceneTopology | undefined;
  redo(currentState: SceneTopology): SceneTopology | undefined;
  canUndo(): boolean;
  canRedo(): boolean;
}

/**
 * Creates an undo/redo history manager for scene topology states.
 * Pushing a new state clears the redo stack.
 * Undo/redo require the current state so it can be saved to the opposite stack.
 */
export function createSceneHistory(): SceneHistory {
  const undoStack: SceneTopology[] = [];
  const redoStack: SceneTopology[] = [];

  return {
    push(state: SceneTopology): void {
      undoStack.push(state);
      redoStack.length = 0;

      if (undoStack.length > MAX_HISTORY_SIZE) {
        undoStack.shift();
      }
    },

    undo(currentState: SceneTopology): SceneTopology | undefined {
      const previousState = undoStack.pop();

      if (previousState === undefined) {
        return undefined;
      }

      redoStack.push(currentState);
      return previousState;
    },

    redo(currentState: SceneTopology): SceneTopology | undefined {
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
