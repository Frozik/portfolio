import { preparePuzzle } from '../domain/geometry';
import type { SceneRepresentation } from '../domain/render-types';
import type { Vec3Array } from '../domain/topology-types';
import type { PuzzleDefinition } from '../domain/types';
import { createSceneStateController } from './scene-state-controller';

const TETRAHEDRON: PuzzleDefinition = {
  id: 'tetrahedron',
  input: {
    figures: [
      {
        vertices: [
          [0, 0, 0],
          [2, 0, 0],
          [1, 0, 2],
          [1, 2, 1],
        ],
        faces: [
          [0, 1, 2],
          [0, 1, 3],
          [1, 2, 3],
          [0, 2, 3],
        ],
      },
    ],
  },
  expected: {},
};

function createController() {
  const figureTopology = preparePuzzle(TETRAHEDRON).topology;
  const controller = createSceneStateController({ puzzle: TETRAHEDRON, figureTopology });
  const frames: SceneRepresentation[] = [];
  controller.attachRenderer({ applySceneState: frame => frames.push(frame) });
  return { controller, frames };
}

const EDGE_COUNT = 6;
/** Inside the base face, so a line from it to the apex is collinear with no edge. */
const BASE_POINT: Vec3Array = [1, 0, 1];
const APEX: Vec3Array = [1, 2, 1];

describe('scene state controller', () => {
  it('starts with the figure edges and nothing to undo or redo', () => {
    const { controller } = createController();

    expect(controller.getTopology().lines).toHaveLength(EDGE_COUNT);
    expect(controller.history.canUndo).toBe(false);
    expect(controller.history.canRedo).toBe(false);
  });

  it('pushes the scene to the renderer as soon as it is attached', () => {
    const { frames } = createController();

    expect(frames).toHaveLength(1);
  });

  it('connecting two vertices adds a line, clears the selection and opens the undo stack', () => {
    const { controller, frames } = createController();
    controller.setSelection({ type: 'line', lineId: 0 });

    controller.connectVertices(BASE_POINT, APEX);

    const added = controller.getTopology().lines.at(-1);
    expect(added?.kind).toBe('line');
    expect(controller.hasSelection()).toBe(false);
    expect(controller.history.canUndo).toBe(true);
    expect(frames.length).toBeGreaterThan(1);
  });

  it('undo restores the previous topology and redo brings the line back', () => {
    const { controller } = createController();
    controller.connectVertices(BASE_POINT, APEX);

    controller.undo();
    expect(controller.getTopology().lines).toHaveLength(EDGE_COUNT);
    expect(controller.history).toEqual({ canUndo: false, canRedo: true });

    controller.redo();
    expect(controller.getTopology().lines).toHaveLength(EDGE_COUNT + 1);
    expect(controller.history).toEqual({ canUndo: true, canRedo: false });
  });

  it('a new change after undo drops the redo stack', () => {
    const { controller } = createController();
    controller.connectVertices(BASE_POINT, APEX);
    controller.undo();

    controller.connectVertices([0.5, 0, 0.5], APEX);

    expect(controller.history.canRedo).toBe(false);
  });

  it('draws a parallel line through a vertex only while a line is selected', () => {
    const { controller } = createController();
    const before = controller.getTopology().lines.length;

    controller.createParallelLineAtVertex([1, 2, 1]);
    expect(controller.getTopology().lines).toHaveLength(before);

    controller.setSelection({ type: 'line', lineId: 0 });
    controller.createParallelLineAtVertex([1, 2, 1]);

    const parallel = controller.getTopology().lines.at(-1);
    expect(parallel?.kind).toBe('line');
    expect(parallel?.pointA).toEqual([1, 2, 1]);
    expect(parallel?.pointB).toEqual([3, 2, 1]);
    expect(controller.hasSelection()).toBe(false);
  });

  it('double-tapping an edge extends it, again collapses it, and on a construction line removes it', () => {
    const { controller } = createController();
    const findLine = (lineId: number) =>
      controller.getTopology().lines.find(line => line.lineId === lineId);

    controller.toggleLineExtension(0);
    expect(findLine(0)?.kind).toBe('edge-extended');

    controller.toggleLineExtension(0);
    expect(findLine(0)?.kind).toBe('edge');

    controller.connectVertices(BASE_POINT, APEX);
    const constructionLineId = controller.getTopology().lines.at(-1)?.lineId ?? -1;
    controller.toggleLineExtension(constructionLineId);
    expect(findLine(constructionLineId)).toBeUndefined();
  });

  it('reports which line is selected', () => {
    const { controller } = createController();

    controller.setSelection({ type: 'line', lineId: 2 });

    expect(controller.isLineSelected(2)).toBe(true);
    expect(controller.isLineSelected(3)).toBe(false);
  });

  it('a preview line shows up in the next frame and disappears when cleared', () => {
    const { controller, frames } = createController();
    const segmentsBefore = frames.at(-1)?.segments.length ?? 0;

    controller.setPreviewLine({ pointA: [-1, -1, -1], pointB: [4, 4, 4] });
    expect(frames.at(-1)?.segments.length).toBeGreaterThan(segmentsBefore);

    controller.setPreviewLine(undefined);
    expect(frames.at(-1)?.segments).toHaveLength(segmentsBefore);
  });
});
