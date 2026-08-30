import { describe, expect, it } from 'vitest';

import type { BoundingBox } from '../geometry/bounding-box';
import { buildHeightfield } from './build-heightfield';
import type { ElevationSample } from './elevation-sample';
import type { Heightfield } from './heightfield';
import { samplePosition } from './heightfield';

const PLOT_BOUNDS: BoundingBox = { minX: 0, minY: 0, maxX: 30, maxY: 40 };
const SMALL_BOUNDS: BoundingBox = { minX: 0, minY: 0, maxX: 10, maxY: 10 };

/**
 * A 30 × 40 plot rasterised at this resolution has a square grid of exactly one
 * metre, so a mark on a whole metre lands on a grid node and the expectations
 * below can be written in plan coordinates.
 */
const METRE_GRID_RESOLUTION = 41;

/** The same plot at the 0.25 m step the feature ships with at 256². */
const QUARTER_METRE_GRID_RESOLUTION = 161;

/**
 * How far the grid node nearest to a mark off the grid may sit from the mark's
 * own elevation: half a cell of the quarter-metre grid times the slope the marks
 * below describe, rounded up generously.
 */
const NEAREST_NODE_TOLERANCE_METERS = 0.05;

/** A plane that is not axis aligned, so a wrong coefficient cannot hide. */
function planeElevation(x: number, y: number): number {
  return 1.5 + 0.25 * x - 0.1 * y;
}

function everyHeightIsFinite(field: Heightfield): boolean {
  return field.heights.every(height => Number.isFinite(height));
}

/** Elevation at the grid node nearest to a plan point. */
function heightAt(field: Heightfield, x: number, y: number): number {
  const column = Math.round((x - field.originMeters.x) / field.cellSizeMeters);
  const row = Math.round((y - field.originMeters.y) / field.cellSizeMeters);

  return field.heights[row * field.resolution + column];
}

describe('buildHeightfield', () => {
  it('passes through every mark that lands on a grid node', () => {
    const marks: readonly ElevationSample[] = [
      { position: { x: 5, y: 5 }, elevation: 1 },
      { position: { x: 25, y: 8 }, elevation: 2.5 },
      { position: { x: 15, y: 20 }, elevation: 3.75 },
      { position: { x: 7, y: 30 }, elevation: 1.9 },
      { position: { x: 25, y: 35 }, elevation: 6 },
    ];
    const field = buildHeightfield({
      bounds: PLOT_BOUNDS,
      marks,
      targetResolution: METRE_GRID_RESOLUTION,
    });

    for (const mark of marks) {
      expect(heightAt(field, mark.position.x, mark.position.y)).toBeCloseTo(mark.elevation, 4);
    }
  });

  it('comes within half a cell of a mark that falls between grid nodes', () => {
    // A gentle survey — a metre and a half over thirty — so that the half cell
    // between the mark and the node nearest to it is worth a centimetre or two.
    const markElevation = 1.2;
    const field = buildHeightfield({
      bounds: PLOT_BOUNDS,
      marks: [
        { position: { x: 15.4, y: 20.3 }, elevation: markElevation },
        { position: { x: 5, y: 5 }, elevation: 0 },
        { position: { x: 25, y: 5 }, elevation: 1 },
        { position: { x: 5, y: 35 }, elevation: 1 },
      ],
      targetResolution: QUARTER_METRE_GRID_RESOLUTION,
    });

    expect(field.cellSizeMeters).toBeCloseTo(0.25, 9);
    expect(Math.abs(heightAt(field, 15.4, 20.3) - markElevation)).toBeLessThan(
      NEAREST_NODE_TOLERANCE_METERS
    );
  });

  it('reproduces the plane through three marks over the whole grid, hull or not', () => {
    // The marks huddle in one corner, so all but a few cells are extrapolated.
    // A thin-plate spline carries the affine term through them exactly, which a
    // triangulation could only do inside the triangle itself.
    const marks: readonly ElevationSample[] = [
      { position: { x: 4, y: 4 }, elevation: planeElevation(4, 4) },
      { position: { x: 8, y: 5 }, elevation: planeElevation(8, 5) },
      { position: { x: 5, y: 9 }, elevation: planeElevation(5, 9) },
    ];
    const field = buildHeightfield({
      bounds: PLOT_BOUNDS,
      marks,
      targetResolution: METRE_GRID_RESOLUTION,
    });

    for (let row = 0; row < field.resolution; row += 1) {
      for (let column = 0; column < field.resolution; column += 1) {
        const position = samplePosition(field, column, row);

        expect(field.heights[row * field.resolution + column]).toBeCloseTo(
          planeElevation(position.x, position.y),
          4
        );
      }
    }
  });

  it('holds the common level between two marks of equal elevation, and beyond them', () => {
    // The user's survey, and the defect it exposed: the two north marks used to
    // be joined across ground pulled down by the zeros to the south, and the
    // band between them sagged towards a third of their elevation.
    //
    // These five marks happen to describe a plane, which the spline reproduces
    // exactly, so the measured sag is nil; the tolerance is there for the floats
    // alone.
    const field = buildHeightfield({
      bounds: PLOT_BOUNDS,
      marks: [
        { position: { x: 5, y: 35 }, elevation: 1 },
        { position: { x: 25, y: 35 }, elevation: 1 },
        { position: { x: 5, y: 5 }, elevation: 0 },
        { position: { x: 15, y: 5 }, elevation: 0 },
        { position: { x: 25, y: 5 }, elevation: 0 },
      ],
      targetResolution: METRE_GRID_RESOLUTION,
    });

    for (let x = 5; x <= 25; x += 1) {
      expect(heightAt(field, x, 35)).toBeCloseTo(1, 3);

      // North of the marks the grid runs on to y = 40, where the plane keeps
      // rising rather than falling away.
      for (let y = 36; y <= 40; y += 1) {
        expect(heightAt(field, x, y)).toBeGreaterThanOrEqual(heightAt(field, x, y - 1));
      }
    }

    expect(heightAt(field, 15, 20)).toBeCloseTo(0.5, 3);
  });

  it('sags only slightly between two equal marks with lower ground between them', () => {
    // The same pair of level marks, now with a mark ten metres below them right
    // between the two — a survey no plane fits. The spline bends towards it, and
    // the band it leaves is what a thin sheet would do: the measured minimum is
    // 0.92 of the marks' own level.
    const bandMinimum = 0.7;
    const field = buildHeightfield({
      bounds: PLOT_BOUNDS,
      marks: [
        { position: { x: 5, y: 35 }, elevation: 1 },
        { position: { x: 25, y: 35 }, elevation: 1 },
        { position: { x: 15, y: 20 }, elevation: 0 },
        { position: { x: 5, y: 5 }, elevation: 0 },
        { position: { x: 25, y: 5 }, elevation: 0 },
      ],
      targetResolution: METRE_GRID_RESOLUTION,
    });

    for (let x = 5; x <= 25; x += 1) {
      expect(heightAt(field, x, 35)).toBeGreaterThan(bandMinimum);
    }

    expect(heightAt(field, 15, 35)).toBeGreaterThan(bandMinimum);
    expect(heightAt(field, 15, 40)).toBeGreaterThan(bandMinimum);
  });

  it('keeps extrapolation beyond the marks within the surveyed range', () => {
    const marks: readonly ElevationSample[] = [
      { position: { x: 5, y: 5 }, elevation: 0 },
      { position: { x: 25, y: 8 }, elevation: 1.2 },
      { position: { x: 12, y: 22 }, elevation: 2.4 },
      { position: { x: 22, y: 33 }, elevation: 0.6 },
      { position: { x: 7, y: 30 }, elevation: 1.9 },
    ];
    const field = buildHeightfield({
      bounds: PLOT_BOUNDS,
      marks,
      targetResolution: METRE_GRID_RESOLUTION,
    });
    const surveyedSpan = 2.4;
    // A radial kernel grows away from its marks, so the grid's own corners are
    // the test: they may overshoot the survey, but only by a couple of its own
    // vertical extents.
    const overshootAllowance = 2 * surveyedSpan;

    for (const height of field.heights) {
      expect(height).toBeGreaterThan(0 - overshootAllowance);
      expect(height).toBeLessThan(surveyedSpan + overshootAllowance);
    }
  });

  it('averages marks read at the same point', () => {
    const field = buildHeightfield({
      bounds: PLOT_BOUNDS,
      marks: [
        { position: { x: 15, y: 20 }, elevation: 2 },
        { position: { x: 15.005, y: 20 }, elevation: 4 },
        { position: { x: 5, y: 5 }, elevation: 1 },
        { position: { x: 25, y: 35 }, elevation: 1 },
      ],
      targetResolution: METRE_GRID_RESOLUTION,
    });

    expect(heightAt(field, 15, 20)).toBeCloseTo(3, 3);
  });

  it('is level everywhere with a single mark', () => {
    const field = buildHeightfield({
      bounds: PLOT_BOUNDS,
      marks: [{ position: { x: 15, y: 20 }, elevation: 2.5 }],
      targetResolution: 32,
    });

    expect(field.heights.every(height => height === 2.5)).toBe(true);
  });

  it('runs a linear gradient along two marks and clamps past their ends', () => {
    const field = buildHeightfield({
      bounds: { minX: 0, minY: 0, maxX: 40, maxY: 40 },
      marks: [
        { position: { x: 10, y: 20 }, elevation: 0 },
        { position: { x: 30, y: 20 }, elevation: 4 },
      ],
      targetResolution: METRE_GRID_RESOLUTION,
    });

    expect(heightAt(field, 10, 20)).toBeCloseTo(0, 6);
    expect(heightAt(field, 20, 20)).toBeCloseTo(2, 6);
    expect(heightAt(field, 30, 20)).toBeCloseTo(4, 6);

    expect(heightAt(field, 2, 20)).toBeCloseTo(0, 6);
    expect(heightAt(field, 38, 20)).toBeCloseTo(4, 6);

    // Off the line the value is the one at the foot of the perpendicular.
    expect(heightAt(field, 20, 0)).toBeCloseTo(2, 6);
    expect(heightAt(field, 20, 40)).toBeCloseTo(2, 6);
  });

  it('follows the line the marks lie on when they are all collinear', () => {
    const field = buildHeightfield({
      bounds: SMALL_BOUNDS,
      marks: [
        { position: { x: 0, y: 0 }, elevation: 0 },
        { position: { x: 5, y: 5 }, elevation: 2 },
        { position: { x: 10, y: 10 }, elevation: 4 },
      ],
      targetResolution: 8,
    });

    expect(everyHeightIsFinite(field)).toBe(true);
    expect(heightAt(field, 0, 0)).toBeCloseTo(0, 6);
    expect(heightAt(field, 10, 10)).toBeCloseTo(4, 6);
    // Both corners off the line project onto the middle mark.
    expect(heightAt(field, 10, 0)).toBeCloseTo(2, 6);
    expect(heightAt(field, 0, 10)).toBeCloseTo(2, 6);
  });

  it('keeps every cell finite whatever the marks are', () => {
    const markSets: readonly (readonly ElevationSample[])[] = [
      [],
      [{ position: { x: 10, y: 10 }, elevation: 4 }],
      [
        { position: { x: 0, y: 0 }, elevation: 0 },
        { position: { x: 30, y: 40 }, elevation: 5 },
      ],
      [
        { position: { x: 0, y: 0 }, elevation: 0 },
        { position: { x: 0, y: 20 }, elevation: 1 },
        { position: { x: 0, y: 40 }, elevation: 2 },
      ],
      [
        { position: { x: 7, y: 7 }, elevation: 2 },
        { position: { x: 7, y: 7 }, elevation: 2 },
        { position: { x: 7, y: 7 }, elevation: 2 },
      ],
      [
        // Marks outside the plot, and two on top of each other.
        { position: { x: -50, y: -50 }, elevation: -3 },
        { position: { x: 15, y: 20 }, elevation: 1 },
        { position: { x: 15, y: 20 }, elevation: 1 },
        { position: { x: 90, y: 120 }, elevation: 8 },
      ],
      [
        // A mark that never got a reading at all.
        { position: { x: Number.NaN, y: 10 }, elevation: 1 },
        { position: { x: 5, y: 5 }, elevation: 0 },
        { position: { x: 25, y: 35 }, elevation: Number.POSITIVE_INFINITY },
      ],
      [
        // Marks a hair off one line: too near it to bend a sheet across it.
        { position: { x: 5, y: 5 }, elevation: 0 },
        { position: { x: 15, y: 15.002 }, elevation: 1 },
        { position: { x: 25, y: 25 }, elevation: 2 },
      ],
    ];

    for (const marks of markSets) {
      const field = buildHeightfield({ bounds: PLOT_BOUNDS, marks, targetResolution: 32 });

      expect(everyHeightIsFinite(field)).toBe(true);
    }
  });

  it('carries the surveyed slope across the whole square grid, not only the plot box', () => {
    // The grid is square on the longer side, so a 30 × 40 plot leaves a ten
    // metre strip east of the box that the surface has to cover as well. These
    // four marks describe an even north-facing slope of 4 m over 30, which the
    // spline carries on through the strip rather than levelling off at the
    // outermost marks.
    const field = buildHeightfield({
      bounds: PLOT_BOUNDS,
      marks: [
        { position: { x: 5, y: 5 }, elevation: 0 },
        { position: { x: 25, y: 5 }, elevation: 0 },
        { position: { x: 5, y: 35 }, elevation: 4 },
        { position: { x: 25, y: 35 }, elevation: 4 },
      ],
      targetResolution: METRE_GRID_RESOLUTION,
    });
    const surveyedSlope = 4 / 30;
    const eastColumn = field.resolution - 1;

    expect(samplePosition(field, eastColumn, 0).x).toBeCloseTo(40, 9);

    for (let row = 0; row < field.resolution; row += 1) {
      const { y } = samplePosition(field, eastColumn, row);

      expect(field.heights[row * field.resolution + eastColumn]).toBeCloseTo(
        (y - 5) * surveyedSlope,
        4
      );
    }
  });

  it('stays flat at the datum with no marks at all', () => {
    const field = buildHeightfield({ bounds: PLOT_BOUNDS, marks: [], targetResolution: 32 });

    expect(field.heights.every(height => height === 0)).toBe(true);
  });

  it('rebuilds a 256² grid from thirty marks well inside the interaction budget', () => {
    const marks: ElevationSample[] = [];

    for (let index = 0; index < 30; index += 1) {
      marks.push({
        position: {
          x: ((index * 7) % 29) + 0.5,
          y: ((index * 13) % 39) + 0.5,
        },
        elevation: Math.sin(index) * 2,
      });
    }

    const startedAtMs = performance.now();
    const field = buildHeightfield({ bounds: PLOT_BOUNDS, marks, targetResolution: 256 });
    const elapsedMs = performance.now() - startedAtMs;

    expect(everyHeightIsFinite(field)).toBe(true);
    // Measured at 18 ms — one solve of a 33² system and 256² × 30 kernel
    // evaluations. The assertion is deliberately loose so a busy CI machine
    // cannot turn a performance guard into a flaky test.
    expect(elapsedMs).toBeLessThan(200);
  });
});
