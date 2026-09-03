import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import { downloadBlob, downloadFile } from '../../../shared/lib/downloadFile';
import type { SitePlan } from '../domain/model/site-plan';
import { serializeSitePlan } from '../domain/model/snapshot';
import { computeExportViewport } from '../domain/view/export-viewport';
import type { PlanContent, PlanLabels } from './render/plan-draw/draw-plan';
import { drawPlan } from './render/plan-draw/draw-plan';
import { createRasterImage } from './render/plan-images';
import { readPlanContent } from './render/read-plan-content';
import type { SitePlannerStore } from './SitePlannerStore';

const JSON_MIME_TYPE = 'application/json';
const PNG_MIME_TYPE = 'image/png';
const FILE_NAME_PREFIX = 'site-plan-';

/** The plan as a document: the very bytes the planner reads back on import. */
export function exportPlanJson(plan: SitePlan): void {
  downloadFile(planFileName('json'), serializeSitePlan(plan), JSON_MIME_TYPE);
}

/**
 * The plan as a sheet: the whole plot at a round scale, with the compass and the
 * scale bar that make it measurable, drawn by the very function that paints the
 * editor — so the file is the plan as the user last saw it, minus the editing
 * chrome and plus every layer they left visible.
 *
 * Reports whether a file was produced; a browser that refuses to encode the
 * canvas is the one failure the caller has to tell the user about.
 */
export async function exportPlanPng({
  store,
  labels,
}: {
  readonly store: SitePlannerStore;
  readonly labels: PlanLabels;
}): Promise<boolean> {
  const content = readPlanContent(store);
  const viewport = computeExportViewport(store.siteBounds);

  const canvas = document.createElement('canvas');

  canvas.width = viewport.widthPx;
  canvas.height = viewport.heightPx;

  const ctx = canvas.getContext('2d');

  if (isNil(ctx)) {
    return false;
  }

  try {
    drawPlan(ctx, viewport, {
      content,
      images: { overlayImage: buildOverlayImage(content) },
      labels,
    });

    const blob = await encodePng(canvas);

    if (isNil(blob)) {
      return false;
    }

    downloadBlob(planFileName('png'), blob);

    return true;
  } finally {
  }
}

/** `site-plan-2026-08-30.json` — the plan and the day it was taken off the editor. */
function planFileName(extension: string): string {
  return `${FILE_NAME_PREFIX}${Temporal.Now.plainDateISO().toString()}.${extension}`;
}

function buildOverlayImage(content: PlanContent): OffscreenCanvas | undefined {
  const { analysisRaster } = content;

  return isNil(analysisRaster) || !content.visibleLayers.has('analysis')
    ? undefined
    : createRasterImage(analysisRaster);
}

function encodePng(canvas: HTMLCanvasElement): Promise<Blob | undefined> {
  return new Promise(resolve => {
    canvas.toBlob(blob => resolve(blob ?? undefined), PNG_MIME_TYPE);
  });
}
