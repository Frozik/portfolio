import { CANVAS2D_BACKEND } from '@frozik/charts/canvas2d/painter';
import { canvasRectPainter } from '@frozik/charts/canvas2d/rect-painter';
import type { IChartFrame } from '@frozik/charts/core/frame/chart-frame';
import type { ICrosshairSlice } from '@frozik/charts/core/frame/crosshair';
import { ACTIVE_FPS } from '@frozik/charts/core/frame/frame-demand';
import type { IPixelRect } from '@frozik/charts/core/frame/pixel-rect';
import { dashed } from '@frozik/charts/core/frame/rect-pattern';
import type { IChartExtension } from '@frozik/charts/core/kernel/extension';
import type { IChartKernel } from '@frozik/charts/core/kernel/kernel';
import { ownFrame, PAINT_BAND } from '@frozik/charts/core/stage/backend';
import { xToPixel } from '@frozik/charts/core/viewport/plot-mapping';
import { WEBGPU_BACKEND } from '@frozik/charts/webgpu/painter';
import { rectPainter } from '@frozik/charts/webgpu/rect-painter';
import { isNil } from 'lodash-es';

import { PEER_CURSOR } from '../palette';

const CURSOR_WIDTH = 1;
const CURSOR_DASH = 6;

interface IPeerCursor<TX> {
  readonly owner: IChartKernel<TX>;
  readonly x: TX;
}

export interface ISyncGroup<TX> {
  /** The extension that makes a chart a member of the group; one call per chart. */
  member(): IChartExtension<TX, 'sync', undefined>;
}

/**
 * Charts that move as one: panning or zooming any of them moves the others,
 * and the position under the pointer on one is marked on the rest. Written in
 * the application from what the library exports — an extension contract, the
 * kernel, a painter — without touching the library.
 */
export function createSyncGroup<TX>(): ISyncGroup<TX> {
  const members = new Set<IChartKernel<TX>>();
  let cursor: IPeerCursor<TX> | undefined;
  let cursorRevision = 0;
  let isSyncing = false;

  const setCursor = (next: IPeerCursor<TX> | undefined): void => {
    cursor = next;
    cursorRevision += 1;
    for (const member of members) {
      member.frames.raise(ACTIVE_FPS);
    }
  };

  return {
    member: () => ({
      id: 'sync',
      create(kernel) {
        members.add(kernel);

        // Writing to a member makes it report a change of its own; without the guard it would write its not yet updated target back.
        const stopFollowing = kernel.events.on('viewport.changed', ({ scaleId }) => {
          if (isSyncing || !isNil(scaleId)) {
            return;
          }
          isSyncing = true;
          for (const other of members) {
            if (other !== kernel) {
              other.viewport.x.setCurrent(kernel.viewport.x.current);
              other.viewport.x.setTarget(kernel.viewport.x.target);
            }
          }
          isSyncing = false;
        });

        /** A line where another member of the group is pointing; nothing on the chart being pointed at. */
        const peerLineOf = (frame: IChartFrame<TX>): readonly IPixelRect[] => {
          if (isNil(cursor) || cursor.owner === kernel) {
            return [];
          }
          const { plot, size } = frame;
          const pixel = xToPixel(frame, cursor.x);
          if (pixel < plot.left || pixel > plot.right) {
            return [];
          }
          const width = Math.max(1, Math.round(CURSOR_WIDTH * size.devicePixelRatio));
          return [
            { left: Math.round(pixel - width / 2), top: plot.top, width, height: plot.height },
          ];
        };

        const peerCursor = {
          revision: () => cursorRevision,
          batchOf: (frame: IChartFrame<unknown>) => ({
            rects: peerLineOf(ownFrame<TX>(frame)),
            color: PEER_CURSOR,
            opacity: 1,
            pattern: dashed(CURSOR_DASH * frame.size.devicePixelRatio),
          }),
        };

        return {
          slice: undefined,
          tick(): void {
            const point = kernel.extension<ICrosshairSlice<TX>>('crosshair')?.point;
            if (!isNil(point)) {
              if (cursor?.owner !== kernel || kernel.domain.compare(cursor.x, point.x) !== 0) {
                setCursor({ owner: kernel, x: point.x });
              }
            } else if (cursor?.owner === kernel) {
              setCursor(undefined);
            }
          },
          // The same line by either backend: the stage takes the one its stack has.
          paint: [
            {
              id: 'sync',
              backend: WEBGPU_BACKEND,
              band: PAINT_BAND.annotation,
              painter: rectPainter(peerCursor),
            },
            {
              id: 'sync',
              backend: CANVAS2D_BACKEND,
              band: PAINT_BAND.annotation,
              painter: canvasRectPainter(peerCursor),
            },
          ],
          dispose(): void {
            stopFollowing();
            members.delete(kernel);
            if (cursor?.owner === kernel) {
              setCursor(undefined);
            }
          },
        };
      },
    }),
  };
}
