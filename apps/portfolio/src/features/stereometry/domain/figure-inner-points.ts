import { isPointInsideOrOnSurface } from './math';
import type { FigureTopology, Vec3Array } from './topology-types';

/**
 * Memo of the "point lies inside or on any figure face" predicate.
 *
 * `isPointInsideOrOnSurface` is a winding-number scan over every figure triangle
 * and runs once per scene vertex and per construction sub-segment midpoint on
 * every rebuild, i.e. on every pointermove during a drag. The predicate depends
 * only on the point and the immutable figure, so the answer is cached on the
 * point's array identity: position arrays are immutable for a topology version
 * and recur across rebuilds, and identity keys never collide.
 */
export class FigureInnerPointCache {
  private readonly cachesByFigure = new WeakMap<FigureTopology, WeakMap<Vec3Array, boolean>>();

  isInside(figureTopology: FigureTopology, point: Vec3Array): boolean {
    let pointCache = this.cachesByFigure.get(figureTopology);
    if (pointCache === undefined) {
      pointCache = new WeakMap();
      this.cachesByFigure.set(figureTopology, pointCache);
    }

    const cached = pointCache.get(point);
    if (cached !== undefined) {
      return cached;
    }

    const isInside = figureTopology.figureFaceTriangles.some(figureTriangles =>
      isPointInsideOrOnSurface(point, figureTriangles, figureTopology.vertices)
    );
    pointCache.set(point, isInside);
    return isInside;
  }
}
