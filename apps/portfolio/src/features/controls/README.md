# Controls

Financial input controls from the shared component library: precise numeric editors and a natural-language date picker.

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
  keywords (`today`, `tomorrow`, `now`), weekdays (`mon`–`sun`, `next fri`,
  `last monday`), offsets (`+3d`, `-1w`, `in 3 days`, `2 weeks ago`),
  boundaries (`eom`, `bom`, `eoy`, `Q1 2025`), ordinals (`15th`, `the 1st`),
  dates (`2025-01-15`, `15/03/2025`, `10nov`, `jan 15 25`),
  time (`13:00`, `9am`, `5:30pm`, `9:30:45.123`), and combined (`tom 13:00`,
  `mon14`, `yesterday10`)
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
- The popup is a drawer under the field: focus shows only its 20 px handle
  (28 px on touch), hovering the handle slides the whole popup out from under
  the input while the handle shrinks to the popup's closing hairline, leaving
  it slides it back. The keyboard inside the popup holds it out; on touch a
  tap pins it. The slide is a CSS transform clipped at the field's edge
  (`clip-path`) and driven by a registered `@property` factor rather than a
  transition on the transform itself, so flipping sides never sweeps the
  popup across the field; the entry uses `@starting-style`, and the hidden
  part takes no pointer events, so the page under it stays clickable
- Always six weeks in the grid, so the popup keeps its size between months;
  36 px day targets (40 px on touch), today marked with the site's corner
  brackets, the selected day with a solid accent fill, weekends tinted
- Time picker with hour/minute/second/millisecond controls — hold-to-repeat
  (5 steps/second on long press)
- Configurable arrow key step (minute, hour, day, week) and time resolution
  (minutes, seconds, milliseconds)
- Parse direction toggle: future-only vs nearest match
- Weekend highlighting in calendar grid
