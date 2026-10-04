# @frozik/bug-reporter

In-app bug reporting that needs no backend: a bug button, a screenshot
with marks or a tab recording, a comment, and everything a developer asks
for next — console lines, errors, the actions that led there, the network
calls, performance signals and the device — packed into one zip the person
saves to disk and attaches to a ticket. Elements marked as sensitive are
hidden from every capture.

The core is plain TypeScript with no framework: a state machine over a
tiny subscribable store, ports for the browser APIs, and adapters behind
them. React is the first adapter (`react/*`); another framework needs only
a view over `reporter.store`.

```
src/
  core/        the report model, ring buffers, safe serialisation, the annotation model, the archive layout, the ports
  collectors/  console, errors, breadcrumbs, network, performance (LoAF, web-vitals), frame timing, environment, GPU
  capture/     tab capture session, screenshot frame, MediaRecorder, masking, click marks, annotation rasteriser
  archive/     the zip stream (client-zip, stored entries)
  delivery/    File System Access, StreamSaver, Blob download — picked at runtime
  reporter/    the BugReporter state machine and createBugReporter(), the composition root
  react/       BugReporterWidget and the translations
  theme/       bug-reporter.css — masking rules and the widget
  testing/     fakes for every port
```

## Use

```ts
import '@frozik/bug-reporter/theme/bug-reporter.css';
import { createBugReporter } from '@frozik/bug-reporter/reporter/create-bug-reporter';
import { BugReporterWidget } from '@frozik/bug-reporter/react/BugReporterWidget';

// At application start, so the history begins before the bug.
const reporter = createBugReporter({
  appRoot: document.getElementById('root'),
  streamSaverMitmUrl: '/stream-saver/mitm.html',
});

<BugReporterWidget reporter={reporter} locale="en" />;
```

Mark what must never appear in a capture:

```html
<span class="bug-mask">DE12 3456 …</span>   <!-- text drawn transparent under a frosted overlay -->
<div class="bug-block">…</div>              <!-- the whole subtree behind a solid box -->
```

While a capture runs the document root carries `data-bug-capture`, and the
stylesheet keys the masking on it; outside a capture the page is untouched.
Blur alone was rejected: blurred digits are recoverable by deconvolution.
Masked text has no glyph pixels at all — the frosted look is a backdrop
filter over transparent text.

## The flow

`idle → choosing → arming → armed → (capturing → annotating | countdown →
recording | —) → composing → packaging → done`, with `cancel` from
anywhere. Choosing a screenshot or a recording *arms* the reporter: the tab
is requested right away and a fixed bar appears at the top of the page with
*Take screenshot* or *Start recording*, so the person arranges the page
first and captures when ready; during a recording the bar carries the timer
and the stop control. One tab-capture permission per report: the stream is
requested when arming and reused until the report is saved or abandoned. The mask is
held for exactly the span of a capture. Diagnostics are snapshotted at
download, so they contain what happened up to that moment, including
before the button was pressed.

The widget is rendered into `document.body`, a sibling of `appRoot`; the
launcher and panels hide themselves during capture, and only the capture
bar is visible. Element Capture (`restrictTo`) was tried and dropped: an
application root that is not a stacking context is silently ineligible and
the track then delivers no frames at all. A tab capture never draws the
pointer, so the reporter paints a ripple at every click inside `appRoot`.

## The archive

```
bug-report-<time>.zip
  report.md          human-readable: comment, page, browser, recent errors, what is included
  report.json        the manifest: page, comment, attachments, errors, breadcrumbs, network, performance, environment
  console.txt        one line per console call, repeats folded with a count
  screenshots/1.png  with the marks baked in; redactions are opaque pixels
  recording.webm     or .mp4 where the browser records that
```

Each section can be left out from the compose step, and an excluded
section never leaves the browser. Breadcrumbs never carry input values —
only the field, its type and the length of what was typed; password and
payment fields are skipped entirely. Network entries hold the method,
origin and path, status and duration: no headers, no bodies, no query
strings.

## Saving

`createReportSink` picks, in order: `showSaveFilePicker` (Chromium: the
archive streams into the chosen file), StreamSaver (a service worker turns
the stream into a download; needs `streamSaverMitmUrl` pointing at a
same-origin copy of the library's `mitm.html` with `sw.js` beside it, at a
path no other service worker's navigation handling claims), and a Blob
behind a download link everywhere else. The zip is stored, not deflated:
the video and PNGs are already compressed and the text is small.

## Browser support

Tab capture (`getDisplayMedia`) is desktop only. Chromium offers the
current tab as the first choice (`preferCurrentTab`); Firefox and Safari
show their own picker. Recording needs `MediaRecorder` with a WebM or MP4
format. Where capture is unavailable the reporter still collects
diagnostics and the comment, and says so.

## Options

`createBugReporter({ appRoot, maxRecordingMs, videoBitsPerSecond,
maxFrameRate, countdownSeconds, streamSaverMitmUrl, limits, now })`; every
field has a default. `BugReporterWidget` takes `locale` (`en`, `ru`) or a
`translations` object, and `shortcut` (Ctrl/⌘ + Shift + B, on by default).
