import { assertNever } from '@frozik/utils/assert/assertNever';
import { Camera, Disc, Square } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { TReporterPhase } from '../reporter/state';
import type { IBugReporterTranslations } from './translations/types';

const TICK_MS = 250;
const MILLISECONDS = 1_000;
const ICON_SIZE = 16;

/**
 * The fixed bar at the top of the page while a capture is being prepared or
 * runs: the person arranges the page, then takes the screenshot or starts
 * and stops the recording from here. It stays visible during a recording on
 * purpose — the timer and the stop control must be in sight.
 */
export function CaptureBar({
  phase,
  translations,
  onTakeScreenshot,
  onStartRecording,
  onStopRecording,
  onCancel,
}: {
  readonly phase: Extract<TReporterPhase, { kind: 'arming' | 'armed' | 'countdown' | 'recording' }>;
  readonly translations: IBugReporterTranslations;
  readonly onTakeScreenshot: () => void;
  readonly onStartRecording: () => void;
  readonly onStopRecording: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <div className="bug-reporter-bar" role="region" aria-label={translations.menuTitle}>
      <BarContent
        phase={phase}
        translations={translations}
        onTakeScreenshot={onTakeScreenshot}
        onStartRecording={onStartRecording}
        onStopRecording={onStopRecording}
        onCancel={onCancel}
      />
    </div>
  );
}

function BarContent({
  phase,
  translations,
  onTakeScreenshot,
  onStartRecording,
  onStopRecording,
  onCancel,
}: Parameters<typeof CaptureBar>[0]) {
  switch (phase.kind) {
    case 'arming':
      return (
        <>
          <span className="bug-reporter-bar-hint" role="status">
            {translations.arming}
          </span>
          <CancelButton label={translations.cancel} onClick={onCancel} />
        </>
      );
    case 'armed':
      return (
        <>
          <span className="bug-reporter-bar-hint">
            {phase.mode === 'screenshot'
              ? translations.armedScreenshot
              : translations.armedRecording}
          </span>
          {phase.mode === 'screenshot' ? (
            <button
              type="button"
              className="bug-reporter-button bug-reporter-button-primary"
              onClick={onTakeScreenshot}
            >
              <Camera size={ICON_SIZE} aria-hidden="true" />
              {translations.takeScreenshot}
            </button>
          ) : (
            <button
              type="button"
              className="bug-reporter-button bug-reporter-button-record"
              onClick={onStartRecording}
            >
              <Disc size={ICON_SIZE} aria-hidden="true" />
              {translations.startRecording}
            </button>
          )}
          <CancelButton label={translations.cancel} onClick={onCancel} />
        </>
      );
    case 'countdown':
      return (
        <>
          <span className="bug-reporter-bar-hint" role="status" aria-live="assertive">
            {translations.countdown}
          </span>
          <span className="bug-reporter-bar-countdown">{phase.secondsLeft}</span>
          <CancelButton label={translations.cancel} onClick={onCancel} />
        </>
      );
    case 'recording':
      return (
        <>
          <span className="bug-reporter-bar-dot" aria-hidden="true" />
          <span className="bug-reporter-visually-hidden" aria-live="polite">
            {translations.recordingStarted}
          </span>
          <ElapsedTime startedAt={phase.startedAt} format={translations.duration} />
          <span className="bug-reporter-bar-limit">
            / {translations.duration(Math.round(phase.maxDurationMs / MILLISECONDS))}
          </span>
          <button
            type="button"
            className="bug-reporter-button bug-reporter-button-record"
            onClick={onStopRecording}
          >
            <Square size={ICON_SIZE} aria-hidden="true" />
            {translations.stopRecording}
          </button>
        </>
      );
    default:
      return assertNever(phase);
  }
}

function CancelButton({
  label,
  onClick,
}: {
  readonly label: string;
  readonly onClick: () => void;
}) {
  return (
    <button type="button" className="bug-reporter-button" onClick={onClick}>
      {label}
    </button>
  );
}

function ElapsedTime({
  startedAt,
  format,
}: {
  readonly startedAt: number;
  readonly format: (seconds: number) => string;
}) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const timer = setInterval(
      () => setSeconds(Math.floor((performance.now() - startedAt) / MILLISECONDS)),
      TICK_MS
    );
    return () => clearInterval(timer);
  }, [startedAt]);
  return <span className="bug-reporter-bar-time">{format(seconds)}</span>;
}
