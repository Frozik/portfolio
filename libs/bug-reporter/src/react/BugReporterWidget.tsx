import { assertNever } from '@frozik/utils/assert/assertNever';
import type { SyntheticEvent } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEventCallback } from 'usehooks-ts';

import type { BugReporter } from '../reporter/bug-reporter';
import { WIDGET_CLASS } from '../reporter/create-bug-reporter';
import type { IReporterState } from '../reporter/state';
import { CaptureBar } from './CaptureBar';
import { ComposePanel } from './ComposePanel';
import { DonePanel } from './DonePanel';
import { Launcher } from './Launcher';

import { ScreenshotEditor } from './ScreenshotEditor';
import { ShutterFlash } from './ShutterFlash';
import { getBugReporterTranslations } from './translations/translations';
import type { IBugReporterTranslations } from './translations/types';
import { useStoreSnapshot } from './useReporterState';

const SHORTCUT_CODE = 'KeyB';

/**
 * The reporter's whole UI, rendered into `document.body` so it is a sibling
 * of the application root rather than part of the page being captured.
 */
export function BugReporterWidget({
  reporter,
  locale,
  translations,
  shortcut = true,
}: {
  readonly reporter: BugReporter;
  readonly locale?: string;
  readonly translations?: IBugReporterTranslations;
  /** `Ctrl/⌘ + Shift + B` opens the reporter. */
  readonly shortcut?: boolean;
}) {
  const state = useStoreSnapshot(reporter.store);
  const strings = useMemo(
    () => translations ?? getBugReporterTranslations(locale ?? navigator.language),
    [translations, locale]
  );

  useEffect(() => {
    if (!shortcut) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === SHORTCUT_CODE) {
        event.preventDefault();
        reporter.open();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [reporter, shortcut]);

  return createPortal(
    <div className={WIDGET_CLASS}>
      <Launcher
        open={state.phase.kind === 'choosing'}
        capability={state.capability}
        notice={state.phase.kind === 'choosing' ? state.notice : null}
        translations={strings}
        onOpen={reporter.open}
        onClose={reporter.cancel}
        onScreenshot={reporter.armScreenshot}
        onRecord={reporter.armRecording}
        onDescribe={reporter.describeOnly}
      />
      {(state.phase.kind === 'arming' ||
        state.phase.kind === 'armed' ||
        state.phase.kind === 'countdown' ||
        state.phase.kind === 'recording') && (
        <CaptureBar
          phase={state.phase}
          translations={strings}
          onTakeScreenshot={reporter.takeScreenshot}
          onStartRecording={reporter.startRecording}
          onStopRecording={reporter.stopRecording}
          onCancel={reporter.disarm}
        />
      )}
      <Panel reporter={reporter} state={state} translations={strings} />
      <ShutterFlash phase={state.phase} />
    </div>,
    document.body
  );
}

/** One modal dialog for the steps that need the page behind them inert: annotating, composing, done. */
function Panel({
  reporter,
  state,
  translations,
}: {
  readonly reporter: BugReporter;
  readonly state: IReporterState;
  readonly translations: IBugReporterTranslations;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { phase } = state;
  const open =
    phase.kind === 'annotating' ||
    phase.kind === 'composing' ||
    phase.kind === 'packaging' ||
    phase.kind === 'done';
  const fullscreen = phase.kind === 'annotating';

  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  const handleCancel = useEventCallback((event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    if (phase.kind === 'annotating') {
      reporter.discardScreenshot();
    } else if (phase.kind === 'done') {
      reporter.cancel();
    } else if (
      phase.kind === 'composing' &&
      state.comment === '' &&
      state.attachments.length === 0
    ) {
      reporter.cancel();
    }
  });

  /**
   * A second Esc closes a modal dialog regardless of `cancel`'s
   * preventDefault (the close-watcher rule). The draft is not lost to that:
   * the compose step reopens, the other steps leave the flow as Esc would.
   */
  const handleClose = useEventCallback(() => {
    switch (phase.kind) {
      case 'composing':
      case 'packaging':
        dialog.current?.showModal();
        return;
      case 'annotating':
        reporter.discardScreenshot();
        return;
      case 'done':
        reporter.cancel();
        return;
      case 'idle':
      case 'choosing':
      case 'arming':
      case 'armed':
      case 'capturing':
      case 'countdown':
      case 'recording':
        return;
      default:
        assertNever(phase);
    }
  });

  const handleNewReport = useEventCallback(() => {
    reporter.cancel();
    reporter.open();
  });

  return (
    <dialog
      ref={dialog}
      className="bug-reporter-dialog"
      data-fullscreen={fullscreen || undefined}
      aria-label={translations.menuTitle}
      onCancel={handleCancel}
      onClose={handleClose}
    >
      {phase.kind === 'annotating' && (
        <ScreenshotEditor
          screenshot={phase.screenshot}
          translations={translations}
          onDone={reporter.finishAnnotation}
          onDiscard={reporter.discardScreenshot}
        />
      )}
      {(phase.kind === 'composing' || phase.kind === 'packaging') && (
        <ComposePanel
          phase={phase}
          comment={state.comment}
          attachments={state.attachments}
          included={state.included}
          counts={state.counts}
          capability={state.capability}
          notice={state.notice}
          translations={translations}
          onCommentChange={reporter.setComment}
          onIncludedChange={reporter.setIncluded}
          onRemoveAttachment={reporter.removeAttachment}
          onAddScreenshot={reporter.armScreenshot}
          onAddRecording={reporter.armRecording}
          onDownload={reporter.download}
          onCancel={reporter.cancel}
        />
      )}
      {phase.kind === 'done' && (
        <DonePanel
          fileName={phase.fileName}
          translations={translations}
          onNewReport={handleNewReport}
          onClose={reporter.cancel}
        />
      )}
    </dialog>
  );
}
