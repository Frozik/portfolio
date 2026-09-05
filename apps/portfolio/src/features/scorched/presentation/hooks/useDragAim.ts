import { useFunction } from '@frozik/components/hooks/useFunction';
import type { LetterboxTransform } from '@frozik/utils/webgpu/letterboxTransform';
import { isNil } from 'lodash-es';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useRef } from 'react';

import type { AimGhost } from '../../application/aim-ghost';
import type { IPointerAimInput } from '../../application/pointer-aim-source';
import { FIELD_HEIGHT_WU, TANK_CENTER_OFFSET_WU } from '../../domain/constants';
import { resolveDragAim } from '../../domain/drag-aim';
import { toWorldPosition } from '../../domain/view-transform';

export interface DragAimHandlers {
  onPointerDown(event: ReactPointerEvent<HTMLCanvasElement>): void;
  onPointerMove(event: ReactPointerEvent<HTMLCanvasElement>): void;
  onPointerUp(event: ReactPointerEvent<HTMLCanvasElement>): void;
  onPointerCancel(event: ReactPointerEvent<HTMLCanvasElement>): void;
}

export interface DragAimOrigin {
  readonly columnIndex: number;
  readonly positionY: number;
}

/**
 * [§12.2] Drag-to-aim on the field, shared by touch and mouse: the vector from the active tank to
 * the pointer sets angle and power together while the dotted ghost shows the arc. Releasing ends
 * the gesture and nothing else — firing is a separate, deliberate act.
 */
export function useDragAim(params: {
  readonly transform: LetterboxTransform;
  readonly pointerInput: IPointerAimInput;
  readonly aimGhost: AimGhost;
  readonly getOrigin: () => DragAimOrigin | undefined;
  readonly getMaxPower: () => number;
  readonly isEnabled: boolean;
}): DragAimHandlers {
  const { transform, pointerInput, aimGhost, getOrigin, getMaxPower, isEnabled } = params;
  const pointerIdRef = useRef<number | undefined>(undefined);

  const updateAim = useFunction((event: ReactPointerEvent<HTMLCanvasElement>) => {
    const origin = getOrigin();
    const bounds = event.currentTarget.getBoundingClientRect();

    if (isNil(origin) || transform.scale <= 0) {
      return;
    }

    const pointer = toWorldPosition(
      transform,
      event.clientX - bounds.left,
      event.clientY - bounds.top,
      FIELD_HEIGHT_WU
    );

    pointerInput.setDragAim(
      resolveDragAim(
        {
          x: pointer.x - (origin.columnIndex + 0.5),
          y: pointer.y - (origin.positionY + TANK_CENTER_OFFSET_WU),
        },
        getMaxPower()
      )
    );
  });

  const onPointerDown = useFunction((event: ReactPointerEvent<HTMLCanvasElement>) => {
    // A second finger landing on the field is ignored so the aim never fights itself.
    if (!isEnabled || !isNil(pointerIdRef.current)) {
      return;
    }

    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    aimGhost.setVisible(true);
    updateAim(event);
  });

  const onPointerMove = useFunction((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }

    updateAim(event);
  });

  const onPointerUp = useFunction((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (pointerIdRef.current !== event.pointerId) {
      return;
    }

    pointerIdRef.current = undefined;
    aimGhost.setVisible(false);
    pointerInput.setDragAim(undefined);
  });

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp };
}
