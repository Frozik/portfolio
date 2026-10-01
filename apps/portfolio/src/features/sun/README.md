# Sun

A WebGPU benchmark: a sun of as many triangles as the device draws at its display's frame rate, with a report of the graphics card.

Live: [https://frozik.github.io/portfolio/sun](https://frozik.github.io/portfolio/sun) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/sun/`.

A sphere of triangle instances — time-based animation, neon gradient
colouring, drifting sunspots, 4x MSAA — that doubles as a performance test.
Interactive orbit camera via mouse drag and touch with rotation inertia.

## The test

It answers one question: how many triangles does this device draw without
leaving the frame rate of its own display?

1. **The display's rate.** For about a second nothing is drawn and the gaps
   between animation frames are read: 60 Hz, 120 Hz, whatever the screen runs
   at. The median finds the cadence and the mean of the gaps near it gives
   the value, so Safari's millisecond clock still reads 60, not 59.
2. **The search.** From 50,000 triangles the count doubles while a second of
   frames keeps that rate, and once a count drops frames the search closes in
   between the last count that held and the first that did not, to within a
   tenth. A window may lose two frames; a count is rejected only when it
   drops frames twice running, so a hitch of the system — or a tab put in the
   background — does not halve the result.
3. **The result** stays on screen and keeps being drawn. Resizing the canvas
   starts the test over, and so does the button in the panel.

Each instance is one triangle laid out on the sphere in the vertex shader, so
the load changes by a single uniform. The triangles shrink as their number
grows, keeping the sphere covered alike: the number found is about triangles
and vertex work, not about overdraw. It is still a number for this scene at
this canvas size — the panel shows the size next to it.

## The panel

Top right, translucent, laid out to be read off a screenshot:

- frame rate against the display's rate, the count being tried and the count
  that holds, the canvas size in device pixels;
- the card: the WebGPU adapter's vendor and architecture, the WebGL renderer
  string (browsers that mask the adapter still name the GPU there), and
  whether drawing is hardware accelerated — the adapter's fallback flag, or
  WebGL refusing a context under `failIfMajorPerformanceCaveat`;
- the limits a renderer runs into first (texture size and array layers,
  buffer and binding sizes, vertex buffers and attributes, bind groups…);
- every optional feature of the WebGPU specification, the supported ones lit
  and the missing ones struck through.

WebGPU has no limit on instance or vertex counts as such — a draw call takes
any 32-bit count; what bounds a scene is buffer and binding sizes, which are
listed, and speed, which is what the test measures.

The copy button puts the full report on the clipboard as text: the result,
the user agent, and every limit and feature, not only the ones shown.

Without WebGPU the panel says how far the bring-up got — no API in the
browser, an insecure page, no adapter (blocklisted card or acceleration
switched off), a refused device, a lost device — next to what WebGL knows of
the card.
