import { describe, expect, it } from 'vitest';

import { createCircle, createRectangle } from '../model/shapes';
import type { PlanViewport } from '../view/plan-viewport';
import type { ShapeHandleKind } from './draw-selection';
import { computeShapeHandles, ROTATION_HANDLE_GAP_PX } from './draw-selection';

const VIEWPORT: PlanViewport = {
  centerMeters: { x: 0, y: 0 },
  pixelsPerMeter: 10,
  widthPx: 400,
  heightPx: 400,
};

const TOLERANCE_PX = 1e-9;

function handleOf(kind: ShapeHandleKind, handles: ReturnType<typeof computeShapeHandles>) {
  const handle = handles.find(candidate => candidate.kind === kind);

  expect(handle).toBeDefined();

  return handle;
}

describe('computeShapeHandles for a rectangle', () => {
  const RECTANGLE = createRectangle({
    center: { x: 0, y: 0 },
    width: 10,
    length: 20,
    rotationDegrees: 0,
  });

  it('exposes eight resize handles and one rotation handle', () => {
    const handles = computeShapeHandles(RECTANGLE, VIEWPORT);

    expect(handles).toHaveLength(9);
    expect(handles.filter(handle => handle.kind === 'rotate')).toHaveLength(1);
    expect(new Set(handles.map(handle => handle.kind)).size).toBe(handles.length);
  });

  it('places the corner handles on the rectangle corners with north up', () => {
    const handles = computeShapeHandles(RECTANGLE, VIEWPORT);

    expect(handleOf('top-left', handles)?.screenPoint).toEqual({ x: 150, y: 100 });
    expect(handleOf('top-right', handles)?.screenPoint).toEqual({ x: 250, y: 100 });
    expect(handleOf('bottom-left', handles)?.screenPoint).toEqual({ x: 150, y: 300 });
    expect(handleOf('bottom-right', handles)?.screenPoint).toEqual({ x: 250, y: 300 });
  });

  it('puts the rotation handle a fixed pixel gap beyond the top edge', () => {
    const handles = computeShapeHandles(RECTANGLE, VIEWPORT);

    expect(handleOf('rotate', handles)?.screenPoint).toEqual({
      x: 200,
      y: 100 - ROTATION_HANDLE_GAP_PX,
    });
  });

  it('turns the handles with the rectangle', () => {
    const rotated = createRectangle({
      center: { x: 0, y: 0 },
      width: 10,
      length: 20,
      rotationDegrees: 90,
    });

    const handles = computeShapeHandles(rotated, VIEWPORT);
    const topHandle = handleOf('top', handles)?.screenPoint;
    const rotateHandle = handleOf('rotate', handles)?.screenPoint;

    // A 90° counter-clockwise turn sends the rectangle's north to plan west.
    expect(topHandle?.x).toBeCloseTo(100, 9);
    expect(topHandle?.y).toBeCloseTo(200, 9);
    expect(rotateHandle?.x).toBeCloseTo(100 - ROTATION_HANDLE_GAP_PX, 9);
    expect(rotateHandle?.y).toBeCloseTo(200, 9);
  });

  it('keeps the rotation handle defined for a rectangle without extent', () => {
    const collapsed = createRectangle({
      center: { x: 0, y: 0 },
      width: 0,
      length: 0,
      rotationDegrees: 30,
    });

    const rotateHandle = handleOf('rotate', computeShapeHandles(collapsed, VIEWPORT))?.screenPoint;

    expect(rotateHandle).toBeDefined();
    expect(Number.isFinite(rotateHandle?.x)).toBe(true);
    expect(Number.isFinite(rotateHandle?.y)).toBe(true);
  });
});

describe('computeShapeHandles for a circle', () => {
  it('exposes a centre handle and a radius handle due east', () => {
    const circle = createCircle({ center: { x: 5, y: 5 }, radius: 4 });

    const handles = computeShapeHandles(circle, VIEWPORT);

    expect(handles.map(handle => handle.kind)).toEqual(['center', 'radius']);

    const center = handleOf('center', handles)?.screenPoint;
    const radius = handleOf('radius', handles)?.screenPoint;

    expect(center).toEqual({ x: 250, y: 150 });
    expect(Math.abs((radius?.x ?? 0) - 290)).toBeLessThan(TOLERANCE_PX);
    expect(radius?.y).toBe(150);
  });
});
