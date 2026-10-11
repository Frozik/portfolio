# Controls

Input controls from the shared component library: precise numeric editors, a natural-language date picker and the form fields of a password vault.

Live: [https://frozik.github.io/portfolio/controls](https://frozik.github.io/portfolio/controls) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/controls/`.

Interactive showcase of financial input controls from the `@frozik/components`
shared library.

**Numeric Editor (Rate / Amount / Number):**
- Configurable decimal precision (0–10 digits) via slider
- PIP highlighting — adjustable start position and size to emphasize significant digits
- Suffix support: type `K`, `M`, `B` for thousands, millions, billions
- Negative values supported

**Date/Time Picker:**
- Free-form text input with fuzzy parsing — understands natural language:
  keywords (`today`, `tomorrow`, `day after tomorrow`, `now`), parts of the
  day (`tonight`, `tomorrow morning`; an hour beside one falls in its half —
  `tonight at 9` is 21:00), weekdays
  (`mon`–`sun`, `next fri`, `this fri`, `last monday`, `next weekend`; beside a date a
  weekday confirms it — `wed 15 jan 2025` — or picks the occurrence that
  falls on it — `fri 13th`), offsets (`+3d`, `-1w`, `+4h`, `30min`, `30s`,
  `1h30min`, `1.5h`, `in 3 days`, `in an hour`, `2 weeks ago`, `next week`) — alone
  they count from today, beside a date or a time they shift it (`eom -4h`,
  `tom 13:00 +30min`, `15 jan 2025 -1d`), the edges of a period (`eom`,
  `bom`, `eow`, `bow`, `boq`, `eoy`, `eod`, `end of next month`), quarters
  (`Q1 2025`), ordinals (`15th`, `the 1st`, `1st of january`),
  dates (`2025-01-15`, `15/03/2025`, `10nov`, `jan 15 25`),
  time (`13:00`, `10 30`, `9am`, `9 pm`, `9 p.m.`, `9.30pm`, `5:30pm`,
  `9:30:45.123`, in another zone `14:30Z`, `14:30 +0200`), numbers
  with nothing but spaces between them, read by how many there are and by
  what each can be (`15 06 27 10 30`; `8 30 15 06 27` is 30 August, because
  30 is no month), and combined, the
  date and the time in either order (`tom 13:00`, `8:30 15.12`,
  `tomorrow at 5pm`, `mon14`, `yesterday10`). Text copied from a page reads
  as typed: a non-breaking space, full-width digits and typographic dashes
  are taken for the plain ones. Input it cannot place in full — `mon 45`, `tom yesterday`,
  `31.06.2025` — is rejected rather than half-read. The parser is three
  layers with its formats kept in tables:
  [`libs/utils/src/date/fuzzy`](../../../../../libs/utils/src/date/fuzzy/README.md)
- The picker owns the time zone and is handed its clock: it passes the moment
  (`getNow()`, asked when the text is read) and its own `timeZone` to the
  parser, so the text is read on the same calendar the grid shows. A clock
  that shows the past moves the whole picker there — "today", `13:00`, `+1h`
  — which is what a backtest needs
- Compact calendar popup sized to its content, not to the field: the time
  pane sits to the right of the calendar while the viewport has room and
  wraps under it when it does not (pure CSS — `flex-wrap` bounded by Radix's
  available-width variable, no resize observers)
- Opens on the side of the field that has room and follows it while the page
  scrolls or the window resizes. Its height is bounded by the roomier of the
  two sides, derived in CSS from Radix's available-height variable — bounding
  it by the current side would let the popup shrink with the room and never
  overflow, which is the only thing Radix flips on. It scrolls inside itself
  only when neither side fits
- The popup is a drawer under the field: focus shows only its 20 px handle,
  hovering the handle slides the whole popup out from under the input while
  the handle shrinks to the popup's closing hairline. It stays out for 0.7 s
  after the mouse leaves (`POPUP_RETRACT_DELAY_MS`), so a slip past its edge
  does not shut it, and coming back within that time keeps it open. The
  keyboard inside the popup holds it out. The slide is a CSS transform
  clipped at the field's edge (`clip-path`) and driven by a registered
  `@property` factor rather than a transition on the transform itself, so
  flipping sides never sweeps the popup across the field; the entry uses
  `@starting-style`, and the hidden part takes no pointer events, so the
  page under it stays clickable
- On touch (`pointer: coarse`) the popover keeps only the 28 px tab, the
  width of the field, and pressing it opens the calendar as a bottom sheet:
  a native modal `<dialog>` in the top layer, which Radix's transformed
  popper wrapper could never host, rising from the bottom edge of the screen
  — full width in portrait, sized to its content and centred in landscape.
  Opening it blurs the field first, so the software keyboard goes away and
  does not come back when the sheet closes, and takes the tab away while it
  is up; its handle, the backdrop and Escape shut it. The slide-in is
  `@starting-style` again, the slide-out transitions `display` and `overlay`
  discretely (`allow-discrete`) so the dialog leaves the top layer only after
  the animation; engines without them cut. The picked value lands in the
  field as usual
- Always six weeks in the grid, so the popup keeps its size between months;
  36 px day targets (40 px on touch), today marked with the site's corner
  brackets, the selected day with a solid accent fill, weekends tinted
- Time picker with hour/minute/second/millisecond controls — hold-to-repeat
  (5 steps/second on long press)
- Configurable arrow key step (minute, hour, day, week) and time resolution
  (minutes, seconds, milliseconds)
- Parse direction toggle: future-only vs nearest match
- Weekend highlighting in calendar grid

**Form controls** (the fields the password vault needs, same rails — each
control a pure module plus a thin component, `--re-*` tokens, en/ru labels):
- `SecretEditor` — a native password input, never a `contentEditable`: the
  value stays inside the input element, autofill and spell check are told to
  stay away, a shown value hides itself again after five seconds
- `MaskedEditor` — IBAN in fours, a phone with a leading `+`; groups are
  margins, so copying gives the bare value
- `TextEditor` — one line of plain text in the family's frame (the login),
  Escape brings back the value it had on focus
- `UrlEditor` — the host bright, the rest of the address dimmed, so
  `bank.example@evil.example` shows where it really goes; an internationalised host also
  shows its ASCII name (`аpple.com` with a Cyrillic `а` → `xn--pple-43d.com`)
- `MonthYearEditor` — a card expiry as `MM/YY`: the slash comes with the first
  year digit, `5` reads as May, a pasted `12/2029` or `2029-12` reads whole; on a fine pointer the twelve months of a year
  peek out under the field like the calendar, on touch the numeric keyboard
  is all
- `Select` / `MultiSelect` / `Combobox` — WAI-ARIA comboboxes: focus stays in
  the field and points at the active option, arrows, Home/End and typed
  letters move, Enter takes; the select family rises as a sheet on touch,
  the combobox keeps its list under the field (a modal sheet would take the
  keyboard away); options may sit under group headings (`role="group"`) and
  carry a picture before the label, also shown in the field (the currency
  select groups by region and shows each sign)
- `Checkbox` (native), `MultilineEditor` (grows with its text, Ctrl+Enter
  moves on), `ListEditor` (add with Enter in the last item, reorder by the ⋮⋮
  handle beside the remove button — drag it, or Space and the arrows — or
  Alt+↑/↓, each control stays with its item; it can number its items, the
  first glowing — the password in use of a rotation), `Tabs` (Radix),
  `FileDrop` (pick, drop or paste, filtered by `accept` alike, bytes handed
  to the owner)

## Agent tools

The fields are exposed to WebMCP agents through the component library's own
tools: `controls_number_read` / `_enter` and `controls_date_read` / `_enter`
take the text a person would type and go through the editors' own
normalisation, rounding, parsing and clamping (`numeric-entry.ts`,
`date-entry.ts`, shared with the components). `controls_read_settings`,
`controls_set_number_format` and `controls_set_date_options` turn the knobs
below them. The field state lives in `ControlsDemoStore` so tools and page
share it. The form fields add `controls_form_*` tools (`form-agent-tools.ts`):
choice lists accept only their options, masked fields go through their mask,
the expiry through `MM/YY`; the password field has none on purpose, the
backup-code list and the file drop neither.
