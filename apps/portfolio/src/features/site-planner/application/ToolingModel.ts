import type { Vector2 } from '@frozik/utils/math/vector2';
import { isEqual } from 'lodash-es';
import { makeAutoObservable } from 'mobx';
import type { ActiveTool } from '../domain/model/editor-mode';
import { isPlanTool, isToolAllowed } from '../domain/model/editor-mode';
import type { ShapeTool } from '../domain/model/selection';
import { isShapeTool } from '../domain/model/selection';
import type { Shape } from '../domain/model/shapes';
import type { ElevationMark } from '../domain/model/site-plan';
import type { KeyPointSnap } from '../domain/view/object-snapping';
import type { OverlayMode } from '../domain/view/overlay-mode';
import type { SitePlannerViewMode } from '../domain/view/view-mode';
import type { PlanEditorCore } from './editor-core';
import type { ElevationMarksModel } from './ElevationMarksModel';
import type { PathHandleHighlight } from './render/plan-draw/draw-paths';
import type { SiteObjectsModel } from './SiteObjectsModel';
import type { SunStudy } from './SunStudy';
import type { UtilityNetworkModel } from './UtilityNetworkModel';

const NO_MEASURE_POINTS: readonly Vector2[] = [];

/** The models whose drafts a tool change or a restored plan must drop. */
export interface DraftOwners {
  readonly sun: SunStudy;
  readonly marks: ElevationMarksModel;
  readonly siteObjects: SiteObjectsModel;
  readonly utilities: UtilityNetworkModel;
}

/**
 * What is in hand: the active tool and the armed primitive, the view and the
 * overlay — and the half-finished gestures a change of any of them drops.
 */
export class ToolingModel {
  /**
   * Whether the properties panel is being handed the keyboard. A shape dragged
   * onto the plan is sized by eye; the panel takes focus so the exact dimension
   * can be typed straight after, and clears the flag once it has.
   */
  isPropertiesFocusPending = false;
  private readonly core: PlanEditorCore;
  private readonly sun: SunStudy;
  private readonly marks: ElevationMarksModel;
  private readonly siteObjects: SiteObjectsModel;
  private readonly utilities: UtilityNetworkModel;

  constructor(core: PlanEditorCore, { sun, marks, siteObjects, utilities }: DraftOwners) {
    this.core = core;
    this.sun = sun;
    this.marks = marks;
    this.siteObjects = siteObjects;
    this.utilities = utilities;

    makeAutoObservable<ToolingModel, 'core' | 'sun' | 'marks' | 'siteObjects' | 'utilities'>(
      this,
      { core: false, sun: false, marks: false, siteObjects: false, utilities: false },
      { autoBind: true }
    );
  }

  setViewMode(viewMode: SitePlannerViewMode): void {
    this.core.viewMode = viewMode;

    // The two views are two windows onto one plan, so the editing session
    // survives the switch: which building is open, which storey is active and
    // what the tool is armed with are not 2D state. Dropping them here made
    // Tab a silent way to lose your place — and made showing the active storey
    // in 3D impossible, because arriving there always ended the session first.
    // Canvas gestures are still the plan's; the 3D view stays a viewer.

    // Nothing watches the sun outside the 3D view, and a timer left running
    // would keep recomputing a light nobody is looking at.
    if (viewMode !== 'scene') {
      this.sun.stopAnimation();
    }

    // Cut/fill is an earthworks planning readout — it belongs to the plan, so
    // the 3D view opens with no overlay rather than a meaningless colouring.
    if (viewMode === 'scene' && this.core.overlayMode === 'cut-fill') {
      this.core.overlayMode = 'none';
    }
  }

  /** The Tab hotkey: the plan and the 3D view are two windows onto one plan. */
  toggleViewMode(): void {
    this.setViewMode(this.core.viewMode === 'plan' ? 'scene' : 'plan');
  }

  /** The overlay segment of the toolbar; it colours the plan and the 3D view alike. */
  setOverlayMode(overlayMode: OverlayMode): void {
    this.core.overlayMode = overlayMode;
  }

  /**
   * One-shot placement (R30): the moment an object lands, the tool hands it
   * over to the select tool with the object selected, so the very next click
   * adjusts what was just placed instead of dropping a second one beside it —
   * the direct-manipulation habit of Figma and Planner 5D. The tool's own key
   * or its rail button re-arms it for the next one.
   *
   * Two kinds of tool stay in hand instead. Those that draw a RUN — walls,
   * paths, trenches, elevation marks — because their gesture already says when
   * it is finished. And furniture and electrics, because furnishing a room and
   * wiring a storey ARE runs of placements: 💬 the sofa is followed by the
   * table, the socket by the next socket.
   */
  finishPlacement(): void {
    this.setActiveTool('select');
  }

  /**
   * Arms a primitive without reaching for a tool. The plot's shape tool and the
   * building's slab tool draw the SAME primitives, so they share the armed one:
   * whichever was last picked is what both of them draw.
   */
  setArmedShapeTool(armedShapeTool: ShapeTool): void {
    this.core.armedShapeTool = armedShapeTool;
  }

  setActiveTool(activeTool: ActiveTool): void {
    if (!isToolAllowed(this.core.editorMode, activeTool)) {
      return;
    }

    this.core.activeTool = activeTool;

    if (isPlanTool(activeTool) && isShapeTool(activeTool)) {
      this.core.armedShapeTool = activeTool;
    }

    this.core.draftShape = undefined;
    this.core.draftMark = undefined;
    this.core.activeKeyPointSnap = undefined;
    this.marks.closeElevationInput();
    this.core.measurePoints = NO_MEASURE_POINTS;
    this.siteObjects.cancelDraftPath();
  }

  setMeasurePoints(measurePoints: readonly Vector2[]): void {
    this.core.measurePoints = measurePoints;
  }

  setDraftShape(draftShape: Shape | undefined): void {
    this.core.draftShape = draftShape;
  }

  setDraftMark(draftMark: ElevationMark | undefined): void {
    this.core.draftMark = draftMark;
  }

  setActiveKeyPointSnap(activeKeyPointSnap: KeyPointSnap | undefined): void {
    this.core.activeKeyPointSnap = activeKeyPointSnap;
  }

  /** Guarded against no-op writes: the pointer reports every move, the canvas need not redraw for each. */
  setPathHandleHighlight(highlight: PathHandleHighlight | undefined): void {
    if (!isEqual(this.core.pathHandleHighlight, highlight)) {
      this.core.pathHandleHighlight = highlight;
    }
  }

  /** Asks the properties panel for the keyboard, once the panel is on screen. */
  requestPropertiesFocus(): void {
    this.isPropertiesFocusPending = true;
  }

  consumePropertiesFocus(): void {
    this.isPropertiesFocusPending = false;
  }

  /** Drops every half-finished gesture; a plan that arrives whole invalidates them. */
  cancelDrafts(): void {
    this.core.draftShape = undefined;
    this.core.draftMark = undefined;
    this.core.activeKeyPointSnap = undefined;
    this.siteObjects.cancelDraftPath();
    this.utilities.cancelDraftUtilityRoute();
    this.marks.closeElevationInput();
  }

  /** Owns no timer or subscription; here so the store's teardown chain names every model. */
  dispose(): void {}
}
