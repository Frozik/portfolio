/**
 * Undo/redo over immutable snapshots of `T`.
 *
 * The current state lives with the owner (a store, a controller), not inside
 * the history — `undo`/`redo` take it as an argument so it can be moved onto
 * the opposite stack. That keeps the history free of any assumption about how
 * the owner stores or applies a snapshot.
 */
export interface SnapshotHistory<T> {
  /** Records a restorable snapshot and drops everything redoable. */
  push(snapshot: T): void;
  /** Returns the previous snapshot, banking `current` for a later redo. */
  undo(current: T): T | undefined;
  /** Returns the snapshot undone last, banking `current` for a later undo. */
  redo(current: T): T | undefined;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
}

const DEFAULT_HISTORY_LIMIT = 100;

export function createHistory<T>({
  limit = DEFAULT_HISTORY_LIMIT,
}: {
  readonly limit?: number;
} = {}): SnapshotHistory<T> {
  const undoStack: T[] = [];
  const redoStack: T[] = [];

  return {
    push(snapshot: T): void {
      undoStack.push(snapshot);
      redoStack.length = 0;

      if (undoStack.length > limit) {
        undoStack.splice(0, undoStack.length - limit);
      }
    },

    undo(current: T): T | undefined {
      const previous = undoStack.pop();

      if (previous === undefined) {
        return undefined;
      }

      redoStack.push(current);
      return previous;
    },

    redo(current: T): T | undefined {
      const next = redoStack.pop();

      if (next === undefined) {
        return undefined;
      }

      undoStack.push(current);
      return next;
    },

    canUndo(): boolean {
      return undoStack.length > 0;
    },

    canRedo(): boolean {
      return redoStack.length > 0;
    },

    clear(): void {
      undoStack.length = 0;
      redoStack.length = 0;
    },
  };
}
