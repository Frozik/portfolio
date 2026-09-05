import { assertNever } from '@frozik/utils/assert/assertNever';
import { action, observable } from 'mobx';
import { vec3 } from 'wgpu-matrix';

import { FigureInnerPointCache } from '../domain/figure-inner-points';
import { createSceneHistory } from '../domain/history';
import { IntersectionCache } from '../domain/intersection';
import type { SceneRepresentation } from '../domain/render-types';
import { buildRepresentation } from '../domain/representation';
import { computeSolutionStatus } from '../domain/solution-check';
import {
  addLine,
  collapseExtendedLine,
  createTopologyFromPuzzle,
  extendToLine,
  removeLine,
} from '../domain/topology';
import type {
  FigureTopology,
  SceneTopology,
  SelectionState,
  Vec3Array,
} from '../domain/topology-types';
import { SELECTION_NONE } from '../domain/topology-types';
import type { PuzzleDefinition } from '../domain/types';

/** Endpoints of the in-flight drag preview, as resolved by the renderer. */
interface PreviewLine {
  readonly pointA: Vec3Array;
  readonly pointB: Vec3Array;
}

/** The renderer end of the scene state: it receives every rebuilt representation. */
interface SceneRepresentationSink {
  applySceneState(representation: SceneRepresentation): void;
}

export interface ISceneStateControllerParams {
  readonly puzzle: PuzzleDefinition;
  readonly figureTopology: FigureTopology;
}

/** Observable depth of the undo/redo stacks; the toolbar reads it, nothing else writes it. */
export interface SceneHistoryState {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

/**
 * Owns everything the user can change about a puzzle scene — topology, selection,
 * drag preview — together with the undo/redo history over it. Every mutation
 * rebuilds the representation and pushes it to the attached renderer, so callers
 * never touch the render pipeline themselves.
 */
export interface SceneStateController {
  readonly history: SceneHistoryState;
  getTopology(): SceneTopology;
  hasSelection(): boolean;
  isLineSelected(lineId: number): boolean;
  setSelection(selection: SelectionState): void;
  setPreviewLine(previewLine: PreviewLine | undefined): void;
  /** Connects two vertices with a new line and clears the selection. */
  connectVertices(startPosition: Vec3Array, endPosition: Vec3Array): void;
  /** Draws a line through `vertexPosition` parallel to the selected one, then clears the selection. */
  createParallelLineAtVertex(vertexPosition: Vec3Array): void;
  /** Extends a finite line, collapses an extended one, removes a construction line. */
  toggleLineExtension(lineId: number): void;
  undo(): void;
  redo(): void;
  /** Binds the renderer and immediately pushes the current scene into it. */
  attachRenderer(renderer: SceneRepresentationSink): void;
}

export function createSceneStateController(
  params: ISceneStateControllerParams
): SceneStateController {
  const { puzzle, figureTopology } = params;

  const intersectionCache = new IntersectionCache();
  const innerPoints = new FigureInnerPointCache();
  const history = createSceneHistory();
  const historyState = observable({ canUndo: false, canRedo: false });

  let renderer: SceneRepresentationSink | undefined;
  let sceneTopology = createTopologyFromPuzzle(figureTopology, puzzle.input, intersectionCache);
  let selection: SelectionState = SELECTION_NONE;
  let previewLine: PreviewLine | undefined;

  function render(): void {
    const solutionStatus = computeSolutionStatus(puzzle.expected, sceneTopology);
    const representation = buildRepresentation(
      figureTopology,
      sceneTopology.lines,
      sceneTopology.vertices,
      selection,
      previewLine,
      solutionStatus,
      innerPoints
    );

    renderer?.applySceneState(representation);
  }

  const notifyHistoryChange = action((): void => {
    historyState.canUndo = history.canUndo();
    historyState.canRedo = history.canRedo();
  });

  /** Applies a new topology state, saving the previous one to history. */
  function applyTopologyChange(nextTopology: SceneTopology): void {
    history.push(sceneTopology);
    sceneTopology = nextTopology;
    render();
    notifyHistoryChange();
  }

  function getTopology(): SceneTopology {
    return sceneTopology;
  }

  function hasSelection(): boolean {
    return selection.type !== 'none';
  }

  function isLineSelected(lineId: number): boolean {
    return selection.type === 'line' && selection.lineId === lineId;
  }

  function setSelection(nextSelection: SelectionState): void {
    selection = nextSelection;
    render();
  }

  function setPreviewLine(nextPreviewLine: PreviewLine | undefined): void {
    previewLine = nextPreviewLine;
    render();
  }

  /** Direction vector of the currently selected line, or undefined when nothing is selected. */
  function getSelectedDirection(): Vec3Array | undefined {
    switch (selection.type) {
      case 'line': {
        const selectedLineId = selection.lineId;
        const line = sceneTopology.lines.find(candidate => candidate.lineId === selectedLineId);
        if (line === undefined) {
          return undefined;
        }
        return vec3.sub(line.pointB, line.pointA);
      }
      case 'none':
        return undefined;
      default:
        assertNever(selection);
    }
  }

  function connectVertices(startPosition: Vec3Array, endPosition: Vec3Array): void {
    applyTopologyChange(
      addLine(sceneTopology, startPosition, endPosition, figureTopology, intersectionCache)
    );
    setSelection(SELECTION_NONE);
  }

  function createParallelLineAtVertex(vertexPosition: Vec3Array): void {
    const direction = getSelectedDirection();

    if (direction !== undefined) {
      const endPosition: Vec3Array = [
        vertexPosition[0] + direction[0],
        vertexPosition[1] + direction[1],
        vertexPosition[2] + direction[2],
      ];
      applyTopologyChange(
        addLine(sceneTopology, vertexPosition, endPosition, figureTopology, intersectionCache)
      );
    }

    setSelection(SELECTION_NONE);
  }

  function toggleLineExtension(lineId: number): void {
    const line = sceneTopology.lines.find(candidate => candidate.lineId === lineId);
    if (line === undefined) {
      return;
    }

    selection = SELECTION_NONE;

    switch (line.kind) {
      case 'edge':
      case 'segment':
        applyTopologyChange(extendToLine(sceneTopology, lineId, figureTopology, intersectionCache));
        break;
      case 'edge-extended':
      case 'segment-extended':
        applyTopologyChange(
          collapseExtendedLine(sceneTopology, lineId, figureTopology, intersectionCache)
        );
        break;
      case 'line':
        applyTopologyChange(removeLine(sceneTopology, lineId, figureTopology, intersectionCache));
        break;
      default:
        assertNever(line.kind);
    }
  }

  function restoreState(state: SceneTopology | undefined): void {
    if (state === undefined) {
      return;
    }
    sceneTopology = state;
    render();
    setSelection(SELECTION_NONE);
    notifyHistoryChange();
  }

  function undo(): void {
    restoreState(history.undo(sceneTopology));
  }

  function redo(): void {
    restoreState(history.redo(sceneTopology));
  }

  function attachRenderer(nextRenderer: SceneRepresentationSink): void {
    renderer = nextRenderer;
    render();
  }

  return {
    history: historyState,
    getTopology,
    hasSelection,
    isLineSelected,
    setSelection,
    setPreviewLine,
    connectVertices,
    createParallelLineAtVertex,
    toggleLineExtension,
    undo,
    redo,
    attachRenderer,
  };
}
