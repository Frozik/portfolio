import type { IBugReporterTranslations } from './types';

const KILOBYTE = 1_024;
const SECONDS_PER_MINUTE = 60;

export const bugReporterTranslationsEn: IBugReporterTranslations = {
  launcher: 'Report a problem',
  menuTitle: 'Report a problem',
  menuHint:
    'Logs, errors and device details are attached automatically. Fields marked as sensitive are hidden from every capture.',
  screenshot: 'Screenshot',
  record: 'Record screen',
  describe: 'Just describe',
  arming: 'Waiting for the browser to share this tab…',
  armedScreenshot: 'Arrange the page, then take the screenshot.',
  armedRecording: 'Arrange the page, then start recording.',
  takeScreenshot: 'Take screenshot',
  startRecording: 'Start recording',
  countdown: 'Recording starts in',
  stopRecording: 'Stop',
  recordingStarted: 'Recording started',
  editorTitle: 'Mark what matters',
  tools: { rectangle: 'Highlight', arrow: 'Arrow', pen: 'Pen', redact: 'Redact' },
  color: 'Colour',
  strokeWidths: ['Thin line', 'Medium line', 'Thick line'],
  undo: 'Undo',
  redo: 'Redo',
  discard: 'Discard',
  useScreenshot: 'Use screenshot',
  composeTitle: 'Describe the problem',
  commentLabel: 'What happened?',
  commentPlaceholder: 'What were you doing, and what went wrong?',
  attachments: 'Attachments',
  noAttachments: 'No screenshot or recording yet',
  addScreenshot: 'Add screenshot',
  addRecording: 'Add recording',
  remove: 'Remove',
  includedTitle: 'What goes into the archive',
  sections: {
    console: 'Console',
    errors: 'Errors',
    breadcrumbs: 'Actions',
    network: 'Network',
    performance: 'Performance',
    environment: 'Device and browser',
  },
  download: 'Download report (.zip)',
  packaging: 'Packaging…',
  cancel: 'Cancel',
  close: 'Close',
  doneTitle: 'Report saved',
  doneBody: fileName => `Saved as ${fileName}.`,
  doneHint: 'Attach the file to your ticket or message.',
  newReport: 'New report',
  notices: {
    'capture-unsupported':
      'This browser cannot capture the screen; you can still describe the problem.',
    'capture-denied':
      'Screen capture was not allowed. Choose this tab in the browser prompt to capture it.',
    'capture-failed': 'The capture did not succeed. Try again, or describe the problem instead.',
    'recording-unsupported': 'This browser cannot record video; take a screenshot instead.',
    'recording-limit': 'The recording reached its length limit and was stopped.',
    'save-failed': 'The report could not be saved. Try again.',
  },
  duration: seconds => {
    const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
    const rest = seconds % SECONDS_PER_MINUTE;
    return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  },
  bytes: bytes => {
    if (bytes < KILOBYTE) {
      return `${bytes} B`;
    }
    if (bytes < KILOBYTE * KILOBYTE) {
      return `${(bytes / KILOBYTE).toFixed(0)} KB`;
    }
    return `${(bytes / (KILOBYTE * KILOBYTE)).toFixed(1)} MB`;
  },
};
