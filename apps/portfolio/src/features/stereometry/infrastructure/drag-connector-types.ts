import type { Vec3Array } from '../domain/topology-types';

/** What a drag-to-connect gesture starts from, previews and reports back. */
/** Outcome of the hit test performed at pointer-down. Determines drag semantics. */
export type InitialDragHit =
  | { readonly kind: 'vertex'; readonly position: Vec3Array }
  | {
      readonly kind: 'line';
      readonly lineId: number;
      /** `pointB − pointA` of the source line; used to build a parallel line at the snap vertex. */
      readonly direction: Vec3Array;
      /** Any point on the source line; used as the unprojection plane when no snap vertex is present. */
      readonly planeAnchor: Vec3Array;
    };

export type DragPreviewState =
  | {
      readonly kind: 'vertex';
      readonly startPosition: Vec3Array;
      readonly cursorScreenX: number;
      readonly cursorScreenY: number;
      readonly snapTargetPosition: Vec3Array | undefined;
    }
  | {
      readonly kind: 'line';
      readonly sourceDirection: Vec3Array;
      readonly planeAnchor: Vec3Array;
      readonly cursorScreenX: number;
      readonly cursorScreenY: number;
      readonly snapTargetPosition: Vec3Array | undefined;
    };

export interface DragToConnectCallbacks {
  /** Hit-test at pointer-down. Returns whichever candidate wins the unified scoring. */
  readonly performInitialHitTest: (screenX: number, screenY: number) => InitialDragHit | undefined;
  /** Hit-test during drag for snap targets. Ignores lines so they can't override a valid vertex snap. */
  readonly performSnapHitTest: (screenX: number, screenY: number) => Vec3Array | undefined;
  readonly hasActiveSelection: () => boolean;
  readonly onDragStart?: () => void;
  readonly onDragUpdate: (preview: DragPreviewState | undefined) => void;
  readonly onVertexTap: (position: Vec3Array) => void;
  readonly onLineTap: (lineId: number) => void;
  readonly onLineDoubleTap: (lineId: number) => void;
  readonly onDragComplete: (startPosition: Vec3Array, endPosition: Vec3Array) => void;
  /** Invoked when a second pointer arrives during an active interaction so the
   *  camera (which didn't see the first pointer-down because of stopPropagation)
   *  can be handed the first pointer and start pinch-zoom. */
  readonly onSecondPointer: (pointerId: number, clientX: number, clientY: number) => void;
}
