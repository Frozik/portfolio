import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '../../../../shared/ui/Button';
import { DialogShell } from '../../../../shared/ui/DialogShell';
import { UTILITY_SYSTEM_COLORS } from '../../application/render/plan-draw/draw-house';
import { drawPlan } from '../../application/render/plan-draw/draw-plan';
import { buildTemplatePreview } from '../../application/render/template-preview';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { BuildingTemplate } from '../../domain/model/building-template';
import { templateFacts } from '../../domain/model/building-template';
import { parseStockBuilding } from '../../domain/model/snapshot';
import { STOCK_HOUSE_TEMPLATES } from '../../domain/templates/stock-houses';
import { PLAN_LABELS } from '../planLabels';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';

const PREVIEW_WIDTH_PX = 360;
const PREVIEW_HEIGHT_PX = 260;

/**
 * The 2D preview of one stock house, drawn by the very `drawPlan` the editor
 * renders with — walls, rooms, furniture, entry badges, roof plan and all —
 * so what the dialog shows IS what placing the template produces.
 */
const TemplatePreview = observer(({ template }: { readonly template: BuildingTemplate }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const preview = buildTemplatePreview(template.building, PREVIEW_WIDTH_PX, PREVIEW_HEIGHT_PX);

    if (isNil(canvas) || isNil(ctx) || isNil(preview)) {
      return;
    }

    const scale = window.devicePixelRatio || 1;

    canvas.width = PREVIEW_WIDTH_PX * scale;
    canvas.height = PREVIEW_HEIGHT_PX * scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawPlan(ctx, preview.viewport, {
      content: preview.content,
      images: { overlayImage: undefined },
      labels: PLAN_LABELS,
    });
  }, [template]);

  return (
    <canvas
      ref={canvasRef}
      className="h-[260px] w-full rounded-lg border border-white/10"
      aria-label={template.building.name}
    />
  );
});

const AREA_DECIMALS = 0;
const SYSTEM_DOT_SIZE = 'size-2';

/** The house in numbers under the preview: storeys, rooms, area, systems. */
const TemplateFactsLine = observer(({ template }: { readonly template: BuildingTemplate }) => {
  const labels = sitePlannerT.stockHouses;
  const facts = templateFacts(template.building);

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-secondary">
      <span>{`${labels.storeysFact}: ${facts.storeyCount}`}</span>
      <span>{`${labels.roomsFact}: ${facts.roomCount}`}</span>
      <span>{`${facts.areaSquareMeters.toFixed(AREA_DECIMALS)} ${sitePlannerT.plan.squareMeterUnit}`}</span>
      <span className="flex items-center gap-1">
        {facts.systems.map(system => (
          <span
            key={system}
            title={sitePlannerT.house.entries.systems[system]}
            className={`${SYSTEM_DOT_SIZE} rounded-full`}
            style={{ backgroundColor: UTILITY_SYSTEM_COLORS[system] }}
          />
        ))}
      </span>
    </div>
  );
});

const TemplateRow = observer(
  ({
    template,
    isSelected,
    onSelect,
  }: {
    readonly template: BuildingTemplate;
    readonly isSelected: boolean;
    readonly onSelect: (id: string) => void;
  }) => {
    const handleClick = useFunction(() => onSelect(template.id));

    return (
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={handleClick}
        className={cn(
          'rounded-lg border px-3 py-2 text-left text-xs transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          isSelected
            ? 'border-brand-500/60 bg-brand-500/10 text-text'
            : 'border-white/10 text-text-secondary hover:bg-white/5 hover:text-text'
        )}
      >
        {template.building.name}
      </button>
    );
  }
);

/**
 * «Готовый дом»: the catalogue of stock houses — a list on the left, the live
 * plan preview of the chosen one on the right, and the file path underneath
 * for a building exported from another plan.
 */
export const StockHouseDialog = observer(
  ({
    store,
    open,
    onClose,
  }: {
    readonly store: SitePlannerStore;
    readonly open: boolean;
    readonly onClose: () => void;
  }) => {
    const labels = sitePlannerT.stockHouses;
    const [selectedId, setSelectedId] = useState(STOCK_HOUSE_TEMPLATES[0]?.id);
    const [fileIssue, setFileIssue] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const selected = STOCK_HOUSE_TEMPLATES.find(template => template.id === selectedId);

    const handleSelect = useFunction((id: string) => {
      setSelectedId(id);
      setFileIssue(false);
    });
    const handlePlace = useFunction(() => {
      if (!isNil(selected)) {
        store.building.placeStockHouse(selected.id);
        onClose();
      }
    });
    const handleImportClick = useFunction(() => {
      fileInputRef.current?.click();
    });
    const handleFileChange = useFunction(async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      event.target.value = '';

      if (isNil(file)) {
        return;
      }

      const building = parseStockBuilding(await file.text());

      if (isNil(building)) {
        setFileIssue(true);

        return;
      }

      store.building.placeReadyBuilding(building);
      onClose();
    });

    return (
      <DialogShell
        open={open}
        onClose={onClose}
        title={labels.title}
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={handleImportClick}>
              {labels.fromFile}
            </Button>
            <Button variant="primary" size="sm" onClick={handlePlace} disabled={isNil(selected)}>
              {labels.place}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex max-h-72 shrink-0 flex-col gap-1.5 overflow-y-auto pr-1 sm:w-48">
            {STOCK_HOUSE_TEMPLATES.map(template => (
              <TemplateRow
                key={template.id}
                template={template}
                isSelected={template.id === selectedId}
                onSelect={handleSelect}
              />
            ))}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {isNil(selected) ? undefined : (
              <>
                <TemplatePreview template={selected} />
                <TemplateFactsLine template={selected} />
              </>
            )}
            <PanelHint>{fileIssue ? labels.fileIssue : labels.hint}</PanelHint>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleFileChange}
          className="hidden"
          aria-label={labels.fromFile}
        />
      </DialogShell>
    );
  }
);
