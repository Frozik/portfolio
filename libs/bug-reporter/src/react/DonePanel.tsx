import { CheckCircle2 } from 'lucide-react';

import type { IBugReporterTranslations } from './translations/types';

const ICON_SIZE = 28;

export function DonePanel({
  fileName,
  translations,
  onNewReport,
  onClose,
}: {
  readonly fileName: string;
  readonly translations: IBugReporterTranslations;
  readonly onNewReport: () => void;
  readonly onClose: () => void;
}) {
  return (
    <div className="bug-reporter-done">
      <CheckCircle2 size={ICON_SIZE} className="bug-reporter-done-icon" aria-hidden="true" />
      <h2 className="bug-reporter-title">{translations.doneTitle}</h2>
      <p>{translations.doneBody(fileName)}</p>
      <p className="bug-reporter-muted">{translations.doneHint}</p>
      <footer className="bug-reporter-actions">
        <button type="button" className="bug-reporter-button" onClick={onNewReport}>
          {translations.newReport}
        </button>
        <button
          type="button"
          className="bug-reporter-button bug-reporter-button-primary"
          onClick={onClose}
        >
          {translations.close}
        </button>
      </footer>
    </div>
  );
}
