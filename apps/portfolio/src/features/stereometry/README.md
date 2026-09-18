# Stereometry

A 3D construction workbench for stereometry puzzles with per-fragment occlusion of construction lines.

Live: [https://frozik.github.io/portfolio/stereometry](https://frozik.github.io/portfolio/stereometry) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/stereometry/`.

Interactive 3D construction tool for stereometry puzzles — a digital
geometry workbench rendered with WebGPU. Pick a figure, draw
construction lines, find intersection points, and explore cross-sections
of solids.

**Construction:**
- Drag from one vertex to another to draw a construction line; the
  target vertex highlights when your line snaps to it
- Double-click any edge to extend it into an infinite construction
  line that cuts across the figure
- Drag a line onto a vertex to drop a parallel line through that
  point; a quick tap selects the line, and a tap on a vertex then drops
  the parallel too
- Double-click a line to delete it; duplicate lines are ignored
  automatically
- Intersection points appear wherever two lines cross and become
  first-class snap targets for new lines
- Full undo / redo history

**Visuals:**
- Parts of a line occluded by the solid render dashed; visible
  stretches stay solid — decided per-fragment, so the effect stays
  correct from every camera angle
- Vertex markers render as filled or stroked circles and are
  occlusion-tested against both the figure's faces and any lines
  passing through them
- Elements farther from the camera fade smoothly toward transparency,
  giving a sense of depth without needing a grid
- Selection, hover, and "inside the figure" states flow through a
  CSS-like style cascade — adding a new state (e.g. `marked`) is a
  one-line change
- Orthographic or perspective projection with 4× MSAA anti-aliasing

**Interactions:**
- Drag to rotate the camera, Shift+drag to pan, scroll or pinch to
  zoom — with inertia on all three
- Unified pointer handling works identically on mouse, touch, and
  stylus; no duplicate events on mobile

**Puzzles:**

Eight levels, in the order they appear in the picker, across eight solids.
Every one is built with the same three gestures — draw a line between two
points, extend an edge, drop a parallel — and the answer is checked against
the exact geometry, so a construction that merely looks right does not pass.

| # | Puzzle | Solid | What you build |
| --- | --- | --- | --- |
| 1 | Two solids, one line | cube + triangular prism | Two bodies stand on one plane, with a point marking one face of each. Build the line along which those two face planes meet. |
| 2 | Trace of a plane | square pyramid | Three points on the lateral edges fix a cutting plane. Build the trace it leaves on the plane of the base. |
| 3 | Octahedron section | regular octahedron | Three points sit on the edges. Build the pentagon the plane through them cuts out. |
| 4 | Prism section | hexagonal prism | Three points on the base edges — two below, one above. Build the pentagonal section. |
| 5 | Hexagon in a cube | cube | The plane through three marked points crosses all six faces. Build the whole hexagon. |
| 6 | Section parallel to a plane | cuboid | Two segments sharing an endpoint span a plane. Build the section through a marked point parallel to it. |
| 7 | Pyramid section | pentagonal pyramid | Build the section through the given point, parallel to both given lines. |
| 8 | Plane intersection | pentagonal prism | Four segments form two pairs, each pair spanning a plane. Build the line where the two planes meet. |
