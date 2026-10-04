import { EyeOff, MoveUpRight, Pencil, Redo2, Square, Undo2 } from 'lucide-react';
import type { KeyboardEvent, PointerEvent, ReactNode, SyntheticEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { drawShape } from '../capture/rasterize-annotation';
import type { IAnnotation, IPoint, IStroke, TAnnotationTool, TShape } from '../core/annotation';
import {
  addShape,
  ANNOTATION_COLORS,
  ANNOTATION_TOOLS,
  EMPTY_ANNOTATION,
  redo,
  STROKE_WIDTHS,
  undo,
} from '../core/annotation';
import type { IDraftScreenshot } from '../reporter/state';
import type { IBugReporterTranslations } from './translations/types';
import { useObjectUrl } from './useObjectUrl';

const ICON_SIZE = 18;
const TOOL_ICONS: Readonly<Record<TAnnotationTool, ReactNode>> = {
  rectangle: <Square size={ICON_SIZE} aria-hidden="true" />,
  arrow: <MoveUpRight size={ICON_SIZE} aria-hidden="true" />,
  pen: <Pencil size={ICON_SIZE} aria-hidden="true" />,
  redact: <EyeOff size={ICON_SIZE} aria-hidden="true" />,
};

/** The screenshot with a drawing layer: highlight, point, scribble or black out, then keep or discard it. */
export function ScreenshotEditor({
  screenshot,
  translations,
  onDone,
  onDiscard,
}: {
  readonly screenshot: IDraftScreenshot;
  readonly translations: IBugReporterTranslations;
  readonly onDone: (annotation: IAnnotation) => void;
  readonly onDiscard: () => void;
}) {
  const imageUrl = useObjectUrl(screenshot.image);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [tool, setTool] = useState<TAnnotationTool>('rectangle');
  const [color, setColor] = useState(ANNOTATION_COLORS[0] ?? '#ff3b30');
  const [width, setWidth] = useState(STROKE_WIDTHS[0] ?? 1);
  const [annotation, setAnnotation] = useState<IAnnotation>(EMPTY_ANNOTATION);
  const [draft, setDraft] = useState<TShape | null>(null);

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context || size === null) {
      return;
    }
    context.clearRect(0, 0, size.width, size.height);
    for (const shape of annotation.shapes) {
      drawShape(context, shape);
    }
    if (draft !== null) {
      drawShape(context, draft);
    }
  }, [annotation, draft, size]);

  const handleImageLoad = useEventCallback((event: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget;
    setSize({ width: naturalWidth, height: naturalHeight });
  });

  const handlePointerDown = useEventCallback((event: PointerEvent<HTMLCanvasElement>) => {
    const point = toImagePoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraft(startShape(tool, point, { color, width }));
  });

  const handlePointerMove = useEventCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (draft === null) {
      return;
    }
    setDraft(extendShape(draft, toImagePoint(event)));
  });

  const handlePointerUp = useEventCallback(() => {
    if (draft === null) {
      return;
    }
    setAnnotation(current => addShape(current, draft));
    setDraft(null);
  });

  const handleUndo = useEventCallback(() => setAnnotation(current => undo(current)));
  const handleRedo = useEventCallback(() => setAnnotation(current => redo(current)));
  const handleDone = useEventCallback(() => onDone(annotation));
  const handleKeyDown = useEventCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
    }
  });

  return (
    <div className="bug-reporter-editor" onKeyDown={handleKeyDown}>
      <header className="bug-reporter-editor-header">
        <h2 className="bug-reporter-title">{translations.editorTitle}</h2>
        <Toolbar label={translations.editorTitle}>
          {ANNOTATION_TOOLS.map(candidate => (
            <button
              key={candidate}
              type="button"
              className="bug-reporter-tool"
              aria-pressed={candidate === tool}
              aria-label={translations.tools[candidate]}
              title={translations.tools[candidate]}
              onClick={() => setTool(candidate)}
            >
              {TOOL_ICONS[candidate]}
            </button>
          ))}
          <span className="bug-reporter-toolbar-gap" aria-hidden="true" />
          {ANNOTATION_COLORS.map(candidate => (
            <button
              key={candidate}
              type="button"
              className="bug-reporter-swatch"
              style={{ backgroundColor: candidate }}
              aria-pressed={candidate === color}
              aria-label={`${translations.color} ${candidate}`}
              onClick={() => setColor(candidate)}
            />
          ))}
          <span className="bug-reporter-toolbar-gap" aria-hidden="true" />
          {STROKE_WIDTHS.map((candidate, index) => (
            <button
              key={candidate}
              type="button"
              className="bug-reporter-tool"
              aria-pressed={candidate === width}
              aria-label={translations.strokeWidths[index] ?? `${candidate}px`}
              title={translations.strokeWidths[index] ?? `${candidate}px`}
              onClick={() => setWidth(candidate)}
            >
              <StrokeSample width={candidate} />
            </button>
          ))}
          <span className="bug-reporter-toolbar-gap" aria-hidden="true" />
          <button
            type="button"
            className="bug-reporter-tool"
            aria-label={translations.undo}
            title={translations.undo}
            disabled={annotation.shapes.length === 0}
            onClick={handleUndo}
          >
            <Undo2 size={ICON_SIZE} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="bug-reporter-tool"
            aria-label={translations.redo}
            title={translations.redo}
            disabled={annotation.undone.length === 0}
            onClick={handleRedo}
          >
            <Redo2 size={ICON_SIZE} aria-hidden="true" />
          </button>
        </Toolbar>
      </header>
      <div className="bug-reporter-editor-stage">
        <div className="bug-reporter-editor-frame" data-tool={tool}>
          {imageUrl !== null && (
            <img
              src={imageUrl}
              alt=""
              className="bug-reporter-editor-image"
              onLoad={handleImageLoad}
            />
          )}
          {size !== null && (
            <canvas
              ref={canvas}
              width={size.width}
              height={size.height}
              className="bug-reporter-editor-canvas"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          )}
        </div>
      </div>
      <footer className="bug-reporter-actions">
        <button type="button" className="bug-reporter-button" onClick={onDiscard}>
          {translations.discard}
        </button>
        <button
          type="button"
          className="bug-reporter-button bug-reporter-button-primary"
          disabled={size === null}
          onClick={handleDone}
        >
          {translations.useScreenshot}
        </button>
      </footer>
    </div>
  );
}

/** Arrow keys move between the tools, as a toolbar is expected to behave. */
function Toolbar({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  const handleKeyDown = useEventCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }
    const buttons = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
    ];
    const index = buttons.findIndex(button => button === document.activeElement);
    if (index === -1) {
      return;
    }
    const step = event.key === 'ArrowRight' ? 1 : -1;
    buttons[(index + step + buttons.length) % buttons.length]?.focus();
    event.preventDefault();
  });
  return (
    <div
      role="toolbar"
      tabIndex={-1}
      aria-label={label}
      className="bug-reporter-toolbar"
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

function toImagePoint(event: PointerEvent<HTMLCanvasElement>): IPoint {
  const element = event.currentTarget;
  const rect = element.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) * element.width) / rect.width,
    y: ((event.clientY - rect.top) * element.height) / rect.height,
  };
}

/** The sample scales the real stroke down to the toolbar: 36 px would not fit a 34 px button. */
const SAMPLE_SIZE = 18;
const SAMPLE_SCALE = 0.4;

function StrokeSample({ width }: { readonly width: number }) {
  const thickness = Math.max(1, Math.round(width * SAMPLE_SCALE));
  return (
    <svg
      width={SAMPLE_SIZE}
      height={SAMPLE_SIZE}
      viewBox={`0 0 ${SAMPLE_SIZE} ${SAMPLE_SIZE}`}
      aria-hidden="true"
    >
      <circle cx={SAMPLE_SIZE / 2} cy={SAMPLE_SIZE / 2} r={thickness / 2} fill="currentColor" />
    </svg>
  );
}

function startShape(tool: TAnnotationTool, point: IPoint, stroke: IStroke): TShape {
  switch (tool) {
    case 'rectangle':
      return { kind: 'rectangle', from: point, to: point, stroke };
    case 'arrow':
      return { kind: 'arrow', from: point, to: point, stroke };
    case 'pen':
      return { kind: 'pen', points: [point], stroke };
    case 'redact':
      return { kind: 'redact', from: point, to: point };
    default:
      return tool satisfies never;
  }
}

function extendShape(shape: TShape, point: IPoint): TShape {
  switch (shape.kind) {
    case 'rectangle':
    case 'arrow':
    case 'redact':
      return { ...shape, to: point };
    case 'pen':
      return { ...shape, points: [...shape.points, point] };
    default:
      return shape satisfies never;
  }
}
