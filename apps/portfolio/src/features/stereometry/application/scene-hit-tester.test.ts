import { mat4 } from 'wgpu-matrix';

import { IntersectionCache } from '../domain/intersection';
import { createTopologyFromPuzzle } from '../domain/topology';
import type { FigureTopology, SceneTopology } from '../domain/topology-types';
import { createSceneHitTester } from './scene-hit-tester';

const CANVAS = { clientWidth: 200, clientHeight: 200 };
const EMPTY_FIGURE: FigureTopology = {
  vertices: [],
  edges: [],
  faces: [],
  faceTriangles: [],
  figureFaceTriangles: [],
};

/** With an identity MVP, world x/y are clip coordinates: (0,0) lands on the canvas centre. */
const IDENTITY_MVP = mat4.identity() as Float32Array;

function createTester(topology: SceneTopology) {
  return createSceneHitTester({
    canvas: CANVAS,
    getMvpMatrix: () => IDENTITY_MVP,
    getTopology: () => topology,
  });
}

function topologyWith(input: {
  readonly vertices?: readonly [number, number, number][];
  readonly lines?: readonly (readonly [[number, number, number], [number, number, number]])[];
}): SceneTopology {
  return createTopologyFromPuzzle(EMPTY_FIGURE, { figures: [], ...input }, new IntersectionCache());
}

describe('scene hit tester', () => {
  it('snaps to the vertex under the pointer', () => {
    const tester = createTester(topologyWith({ vertices: [[0, 0, 0]] }));

    expect(tester.hitTestSnapVertex(100, 100)).toEqual([0, 0, 0]);
  });

  it('misses a vertex outside the pick radius', () => {
    const tester = createTester(topologyWith({ vertices: [[0, 0, 0]] }));

    expect(tester.hitTestSnapVertex(160, 100)).toBeUndefined();
  });

  it('selects the line under the pointer and nothing when the pointer is far away', () => {
    const tester = createTester(
      topologyWith({
        lines: [
          [
            [-0.5, 0, 0],
            [0.5, 0, 0],
          ],
        ],
      })
    );

    expect(tester.hitTestSelection(100, 100)).toEqual({ type: 'line', lineId: 0 });
    expect(tester.hitTestSelection(100, 20)).toEqual({ type: 'none' });
  });

  it('starts a drag from a vertex when one is under the pointer', () => {
    const tester = createTester(topologyWith({ vertices: [[0, 0, 0]] }));

    expect(tester.hitTestDragStart(100, 100)).toEqual({ kind: 'vertex', position: [0, 0, 0] });
  });

  it('starts a line drag with the line direction and anchor', () => {
    const tester = createTester(
      topologyWith({
        lines: [
          [
            [-0.5, 0, 0],
            [0.5, 0, 0],
          ],
        ],
      })
    );

    expect(tester.hitTestDragStart(100, 100)).toEqual({
      kind: 'line',
      lineId: 0,
      direction: [1, 0, 0],
      planeAnchor: [-0.5, 0, 0],
    });
  });

  it('ignores lines while looking for a snap target', () => {
    const tester = createTester(
      topologyWith({
        lines: [
          [
            [-0.5, 0, 0],
            [0.5, 0, 0],
          ],
        ],
      })
    );

    expect(tester.hitTestSnapVertex(100, 100)).toBeUndefined();
  });
});
