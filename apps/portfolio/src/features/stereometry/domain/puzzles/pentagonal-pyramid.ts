import type { PuzzleDefinition } from '../stereometry-types';

const BASE_RADIUS = 1.0;
const HEIGHT = 1.5;
const SIDES = 5;
const CENTER_Y_OFFSET = HEIGHT / 2;

function createBaseVertices(): [number, number, number][] {
  const vertices: [number, number, number][] = [];

  for (let sideIndex = 0; sideIndex < SIDES; sideIndex++) {
    const angle = (2 * Math.PI * sideIndex) / SIDES;
    vertices.push([BASE_RADIUS * Math.sin(angle), -CENTER_Y_OFFSET, BASE_RADIUS * Math.cos(angle)]);
  }

  return vertices;
}

const baseVertices = createBaseVertices();
const apexVertex: [number, number, number] = [0, HEIGHT - CENTER_Y_OFFSET, 0];

const vertices: [number, number, number][] = [...baseVertices, apexVertex];

const APEX_INDEX = SIDES;

// Base edges: base[i] → base[(i+1) % SIDES]
const baseEdges: [number, number][] = Array.from({ length: SIDES }, (_, sideIndex) => [
  sideIndex,
  (sideIndex + 1) % SIDES,
]);

// Lateral edges: base[i] → apex
const lateralEdges: [number, number][] = Array.from({ length: SIDES }, (_, sideIndex) => [
  sideIndex,
  APEX_INDEX,
]);

// Side faces: [apex, base[i], base[(i+1) % SIDES]]
const sideFaces: number[][] = Array.from({ length: SIDES }, (_, sideIndex) => [
  APEX_INDEX,
  sideIndex,
  (sideIndex + 1) % SIDES,
]);

// Base face: all base vertex indices
const baseFace = Array.from({ length: SIDES }, (_, sideIndex) => sideIndex);

export const PENTAGONAL_PYRAMID: PuzzleDefinition = {
  name: 'Pentagonal Pyramid',
  vertices,
  edges: [...baseEdges, ...lateralEdges],
  faces: [...sideFaces, baseFace],
};
