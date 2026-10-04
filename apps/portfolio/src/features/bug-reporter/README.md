# Bug Reporter

A mock treasury desk wired to `@frozik/bug-reporter`: one bug button captures a screenshot with marks or a tab recording, hides the sensitive numbers, bundles logs, errors, actions and device details into a zip streamed straight to disk.

Live: [https://frozik.github.io/portfolio/bug-reporter](https://frozik.github.io/portfolio/bug-reporter) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/bug-reporter/`; the library lives in [`libs/bug-reporter`](../../../../../libs/bug-reporter/README.md).

The feature is the library's living documentation: the page exists to be
reported on. It is laid out like every other feature — `domain/` (the
deterministic desk: accounts, positions, an equity curve, news),
`application/` (the MobX store that owns the desk, the reporter instance
and the controls that make the page misbehave), `presentation/` (the shell,
its panels and the position columns).

**The desk.** Accounts with IBANs and balances, a `@frozik/table` of
positions, the equity sparkline and market news sit side by side.
Balances, IBANs, quantities and P&L carry the `bug-mask` class; the equity
curve carries `bug-block`. The news and the instrument names are public.
Nothing on the page is masked until a capture runs — the reporter sets
`data-bug-capture` on the document root for exactly the span of a
screenshot or a recording, and the library's stylesheet hides the marked
elements only under that attribute.

**Make something go wrong.** Five buttons produce the kinds of evidence a
report is meant to carry: *Submit transfer* throws an uncaught `TypeError`
from its click handler after a `console.error`; *Recalculate portfolio*
blocks the main thread for 400 ms, which shows up as a long animation
frame; *Refresh quotes* fetches a host that does not resolve, so the
network list gets a failed request; *Rearrange panels* rotates the grid and
shifts the layout; *Flood the console* writes forty lines with nested
objects and a `Map`. The activity list under the buttons is the page's own
memory of what was pressed; the reporter's breadcrumbs are the independent
one.

**Reporting.** The bug button sits bottom right (Ctrl/⌘ + Shift + B opens
it too). It offers a screenshot, a screen recording or words alone.
Choosing either asks the browser for the tab once per report and puts a
fixed bar at the top of the page; the person arranges the page and presses
*Take screenshot* or *Start recording* there. A screenshot opens the editor
— highlight, arrow, pen, redact, undo — before the compose step; a
recording counts down from three in the bar, which then shows the timer and
the stop control, and paints a ripple at every click, because a tab capture
does not record the pointer. The compose step holds the comment, the attachments and the
checklist of what the archive will contain; *Download report (.zip)*
streams it to disk and the done step names the file. The widget hides
itself while a frame is taken; only the capture bar is in a recording.

The store creates the reporter on first use of the page and disposes it
with the page; a real application would create it at start-up so the
console and action history begin before the bug. StreamSaver's page and
worker come from `/portfolio/stream-saver/`, see the app
[README](../../../README.md).
