# Site Planner

A planning tool for a real plot of land: draw the boundary and the building
footprint on a 2D plan, survey the ground with elevation marks, build a
multi-storey house with walls, stairs, roofs, furniture and norm-checked
electrics and utilities, then look at the result in 3D to see how the house
sits on the slope. The plan is the source of truth — every mesh, contour and
overlay is a pure function of it.

Live: [https://frozik.github.io/portfolio/site-planner](https://frozik.github.io/portfolio/site-planner) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/site-planner/`.

**Plan (canvas2d):**
- Stock houses: a catalogue dialog offers complete ready buildings — walls,
  rooms, furniture, electrics, utility entries, a pitched roof — each
  previewed by the very renderer the plan uses, placed with every id minted
  anew, and editable like anything drawn by hand; a building saved from
  another plan loads from a JSON file the same way
- The plot outline and the building footprint are compositions of rectangles,
  circles and ellipses combined with union / subtract. The shapes stay
  parametric, so every size, position and rotation is also typed in exactly —
  metres and degrees from the keyboard, not dragged by eye. A drawn shape hands
  the pointer straight back to the select tool with itself selected and the
  keyboard in its size field, so the rough drag is replaced by the surveyed
  number without reaching for the mouse again — and the next click adjusts what
  was just drawn instead of starting another one
- Terms nest to any depth: any of them can be wrapped into a group, and a
  group folds on its own before joining the fold around it. That is what
  makes "cut a hole in this shape, then subtract the whole result from the
  plot" expressible — a flat list of operations cannot confine a subtraction
  to the part it was drawn against
- The structure tree is rearranged by dragging a term's grip: into a group,
  back out of one to any level, or to another place in the same fold, with
  the arrow buttons kept for the keyboard. A group is refused a drop into
  itself or into anything nested in it, and whichever term ends up first in a
  fold is unioned — a fold starts from nothing, so a leading subtraction
  would fold the whole list away
- Elevation marks go in like survey spots — click a point and type its
  height, or paste a whole block of `x, y, z` lines — and a thin-plate spline
  interpolates them into terrain, drawn back as labelled contour lines. It is
  the surface a thin metal sheet would take pinned at every mark: smooth
  everywhere rather than faceted, exact at the marks, and — through its affine
  term — exactly planar wherever the survey describes a plane, inside the
  marks and out beyond them alike, so the ground between two marks of equal
  height holds that height instead of sagging between them. Marks that all
  share a line leave no sheet to bend and run a profile along that line
  instead. The terrain is sampled over the plot's bounding box because
  interpolation needs the full grid, but only the plot is drawn from it: the
  lines are clipped to the boundary and each caption is placed on the stretch
  inside it
- A catalogue of things to place: trees by species — spruce, pine, thuja and
  broadleaf, each with a silhouette of its own in 3D — and cars, drawn to the
  4.5 × 1.8 m a real one takes and turned by a grip at the nose, so a drive can
  be checked for the room it leaves. Paths (polylines inflated into ribbons,
  reshaped point by point — drag a point, split a segment, remove a bend) and
  a setback line offset inward from the boundary complete the ground plan
- A scanned cadastral plan or a satellite screenshot can be laid under the
  canvas, calibrated by clicking two points and typing the distance between
  them, and traced over
- The plot is drawn the way it is convenient to draw it — square to the sheet
  — and north is placed afterwards, by dragging the needle of the compass
  card's dial (snapped to a degree, to 15° with Shift, free with Alt) or by
  typing the azimuth. One bearing feeds the plan's corner compass, the 3D
  gizmo and the sun alike, so the shadows turn with the needle
- Where on Earth the plot lies is picked off a map rather than typed — a
  Leaflet view of OpenStreetMap, toned to the dark theme, with a pin to click
  or drag. Applying it records the coordinates and, from an offline boundary
  table, the IANA time zone they fall in, so one gesture sets everything the
  sun study reads. The map is fetched only when it is asked for
- Compass, scale bar, snapping grid, a two-point measure tool, per-layer
  visibility, undo / redo, and autosave into IndexedDB
- Needs no WebGPU at all — only the 3D view sits behind the guard

**3D (WebGPU):**
- The terrain is one static grid mesh displaced in the vertex shader from the
  sampled heightfield, with normals from central differences — the surface
  can never drift out of step with the marks. Every sample carries how much of
  the plot covers it, and the fragment shader discards whatever falls outside
  the boundary: the plot stands as an island against the sky, edged by the
  accent line draped along its own outline
- The house is not deformed by the ground: the footprint takes a pad
  elevation (terrain centre / mean / minimum, or set by hand) and an apron
  down to the terrain, the way building pads work in CAD
- Sun and shadows for a date and a time of day at the plot's coordinates
  (St Petersburg by default), from `@frozik/utils/astronomy`, a Temporal port of SunCalc's sun formulas — a single 2048² shadow map
  with PCF filtering, a slider running sunrise to sunset, and a play button
  that animates the day
- Render-on-demand: a frame is encoded only once the camera or the plan
  actually moved

**Buildings:**
- A building opens its own **editor** (double-click it): walls are drawn with
  a rubber band, a live «length · angle» readout beside the cursor and a
  typed length that fixes the segment exactly — the CAD value box — with
  Shift locking the angle and object snap catching the ends and midpoints of
  the walls already standing. They are reference polylines — exterior by the
  outer face, interior by the centreline, the ArchiCAD/Revit convention — and
  carry a construction from
  a catalog (brick, ceramic block, foam concrete, timber, frame, glazing),
  each with its typical thickness typed over freely. The plan fills every
  wall's mitred body (glazing stays translucent), and once a building has
  walls the 3D view extrudes them instead of the solid footprint. A drawn
  wall reshapes like everything else here — squares drag corners, rings add
  them, a double click removes one — and it **closes into a ring**: draw the
  line back onto its start, drag an end onto the other end, or press the
  button, and the contour seals with a mitred seam; Alt+double click cuts a
  ring back open at any corner, or splits an open wall in two, doors and
  sockets staying exactly where they hung
- **Layers** split the building editor into the разделы of a house project —
  structure, walls, furniture, electrical, services — and exactly one is in
  hand at a time. The rail carries the shared tools plus the active layer's
  own, the side column shows that layer's panels, and a click only reaches
  that layer's objects: the other layers stay on the plan as legible context
  (lighter, still what furniture magnetises to and sockets hang on), so a
  sofa is never mistaken for the wall behind it. A layer's object belongs to
  it by what it is — nothing is stored on the object and nothing migrates.
  The layer button on the rail lists them with an eye each; a hidden layer
  leaves the plan, the 3D view and the exported sheet alike, which is how a
  plan of the electrics alone is printed. Q steps to the next layer, Shift+Q
  back, a double click on another layer's object steps into that layer with
  it selected, and a finding in the list opens on the layer where it is fixed.
  Storeys are the other axis: the layer state is one for every floor
- **Storeys stack** with a switcher right in the mode bar. Each one has a
  geometry of its own: its **floor slabs** are objects, and a slab is simply a
  shape — the same rectangle, circle or ellipse the plot is drawn with, rubber
  banded out, dragged, resized and turned by the very same grips, or laid as a
  default plate with a single click. Its edges snap to the walls of the storey
  below without holding a modifier, the way OSNAP works in a CAD editor, so
  «flush with the room downstairs» is a gesture rather than four typed numbers.
  The union of a storey's slabs is its outline, and its walls are held inside
  it — a wall belongs to the floor it stands on and cannot wander off it. That
  is also what lets a floor reach past the storey below with nothing on it: a
  balcony, a canopy deck, the overhang. A new storey inherits copies of the
  slabs beneath it, and a storey drawn before slabs existed still takes its
  outline from the loop its walls close —
  whatever stays uncovered becomes exposed ceiling, zoned as plain membrane,
  a walkable **terrace** or a **green roof** (tinted on the plan, laid as
  real covers in 3D). Every storey carries a floor slab and a roof slab, so a
  house reads as a solid and casts a solid shadow; ±0.000 stands on the
  цоколь, storeys stack floor to floor, and the panel states each one's clear
  height, its level and how far its floor is above the ground. The storey
  below ghosts through while you build on top, storeys the editor is not
  aimed at ghost in 3D as well — while still casting their full shadow,
  because a shadow belongs to the house and not to what is being edited — and
  new buildings start from presets: house, shed, carport on piers
- **Stairs** come from a catalogue like furniture — straight, quarter turn,
  half turn, spiral — and only their intent is stored: the run derives from
  the floor-to-floor height at a comfortable riser, so raising a storey
  re-treads every stair standing in it. A stair cuts its own stairwell in the
  floor above, by headroom rather than by outline, so the floor over the
  lower flight — where the wardrobe upstairs stands — is left alone. One
  placed outside its storey is a porch: it climbs from the graded ground to
  the floor. Stairs move, turn and mirror like any other object, and the plan
  states them the way a floor plan does: treads, the climb arrow and «UP · N»
- **Overhangs and canopies**: an upper storey may reach past the one below —
  its floor is drawn solid, its soffit closed underneath — and **posts** hold
  it up, each deriving its own length from the floor or the graded ground
  beneath it up to one shared ceiling datum, so a canopy on a slope stands
  level. A storey with posts and no walls is a carport: a deck on posts, with
  a carport's shadow rather than a block's
- **Placing is one-shot**: a stair, a post, a slab, a tree hands the pointer
  straight back to the select tool with itself selected, so the next click
  adjusts it instead of dropping a second one beside it. Two kinds of tool stay
  in hand — those that draw a run (walls, paths, trenches, elevation marks),
  whose gesture already says when it is finished, and furniture and electrics,
  because furnishing a room and wiring a storey are runs of placements in their
  own right
- **Pitched roofs** crown the top storey — gable, hip or shed — from four
  numbers: the shape, the slope, the overhang and which way the ridge runs.
  The roof is one height function over the plan and every slope is a plane, so
  an L-shaped house gets a roof cut to its own outline rather than to its
  bounding box, a hip over a square plan collapses into a pyramid on its own,
  and the plan draws the ridge, the hips and the slope arrows as the lines
  where those planes actually meet. It is built as a solid — slope, soffit,
  fascia and the gable walls that close the ends — because a one-sided roof
  casts the wrong shadow and shows a hole from underneath
- **Fireplaces and stoves** stand as objects, and their **flue derives**: it
  rises behind the firebox, opens the floor of every storey above it and comes
  out over the roof at the height the norm asks for — half a metre above a
  ridge it stands close to, level with it a little further out, clearing its
  own stretch of slope beyond that. Drag the fireplace and the chimney follows,
  because there is nothing else to drag
- **Ventilation is planned per storey**: shafts are planted on the floor they
  start on and drawn on every floor they pass through — the chimney in the
  middle of the upstairs bedroom is a thing to plan the walls around, so the
  plan shows it. A **sauna** is a room type that asks for both: a shaft of its
  own (a wet or fired room may not share one) and a stove to heat it
- **Findings** collect every advisory into one list you can walk: a wardrobe
  standing over a stairwell, a wall crossing it, a stair outside the
  comfortable bands, an overhang past what ordinary framing carries with no
  post under it, a storey too low to live in. Each row names the rule and
  takes the editor to the place it is about — nothing is ever blocked
- **Furniture** places from a catalogue of 33 real-sized pieces — beds to a
  kitchen run, IKEA-class wardrobes, dressers and a TV stand, fridge, stove
  and washing machine, plus plumbing fixtures that
  already know their utility system — picked from a fly-out on the left rail
  and placed onto the active storey. Dragged near a wall, a piece turns its
  back and snaps flush against the face (Alt suspends the magnet); a grip
  ahead of its front turns it, and an elevation field hangs a boiler on the
  wall. In 3D every piece is a sculpted low-poly model built to its exact
  catalogue dimensions — a toilet with its bowl and tank, a shower with its
  glass and riser, a bed with mattress and pillows — instanced the way the
  cars and trees are
- **Electrical** wires the storey for real: the panel, outlets and switches
  hang on walls at their code heights, lights go on the ceiling, and a
  two-click connect tool builds the circuits — panel to consumers, switch to
  light. No wire is ever drawn by hand: each run derives along the walls
  through their junctions, the way wiring is actually laid, and re-routes
  itself when a device slides. Where the walls are not the way the cable
  really goes, a **cable route** is clicked out by hand along the ceiling or
  the floor — in a conduit of a standard bore, a chase, trunking, a tray —
  and every run that can reach it follows it instead. Each group carries a
  cable (1.5 mm² for lighting, 2.5 mm² for sockets, switchable), so the
  **cable journal** writes itself: metres per group with the drops to every
  device and a cutting reserve, metres of each conduit and chase, points by
  kind, and a finding whenever a conduit is fuller than the trade pulls. The
  **panel assembly** derives too — an incomer, a breaker per group rated by
  its cable, an RCBO wherever a consumer stands in a wet room, drawn on a
  DIN rail in the smallest stock box with a fifth in reserve — and any wall
  unfolds into an **elevation** with its openings, its points at their
  heights and the drops from the ceiling run. In 3D the runs are tubes at
  their level, dropping to each device
- **Doors and windows** hang on walls and slide along them — never placed
  free — with presets for a door, a window on a sill, and a floor-to-ceiling
  window; in 3D they cut real holes, with the masonry under each sill and
  the lintel over each head kept. **Rooms are never drawn**: the walls cut
  the footprint into regions, each gets a type (kitchen, bathroom, sauna…),
  wet zones tint the floor, and every room is captioned with its area
- Any number of named structures, each with its own footprint, pad and walls,
  and each standing on a **foundation** chosen rather than drawn — slab, stem
  wall or piers, with its depth and plinth typed in metres. The concrete solid
  is derived from the footprint and rendered in 3D as a ledge skirting the
  walls; its volume joins the earthworks report
- **Utility entries** mark where each system comes into the house — power,
  network, water, sewer as sleeves cast into the foundation, gas on the
  facade only (the way the norms have it) — drawn as lettered badges on the
  footprint outline, each with its norm-derived default depth
- **Site utility lines** are clicked out across the plot from those entries —
  a click near the right entry snaps onto it — and the editor knows the
  digging codes as data: water goes below the frost line (an editable site
  setting), cables take their standard cover, a sewer falls at the
  recommended slope for its bore, so its depth along the run is derived
  against the terrain rather than typed. The panel reads back trench volume
  and advisory findings — a run risen too shallow, thin cover under a
  driveway, two systems trenched closer than the code seats them. A drawn
  line reshapes like a garden path: squares drag its bends — near the right
  entry a bend snaps onto it — rings add new ones, a double click removes

**Analysis:**
- Slope shading and D8 flow arrows show where water runs
- Cut / fill under the house pad is reported in cubic metres and coloured
  over the ground — warm where soil comes out, cool where it goes in
- Both overlays are rasterized once on the CPU and handed to the plan and the
  3D view alike, so the two can never disagree about what a colour means

**Export:** the plan as JSON (import reads it straight back) and as a PNG
sheet of the whole plot at a round scale, drawn by the same function that
paints the editor — compass and scale bar included, editing chrome left out.

The parked cars render from a palette-textured low-poly SUV
([Kenney car kit](https://kenney.nl/assets/car-kit), CC0) loaded through the
feature's own minimal GLB parser and fitted exactly to the plan's car
footprint; a sculpted stand-in covers the load.

## Design notes

The editor is spec-driven; the two documents that shipped with the last
waves live beside the code and record both the research and where the
implementation refined it:

- [`layers.md`](./layers.md) — the layer system of the building editor
  (structure · walls · furniture · electrical · services), with the prior art
  from AutoCAD, ArchiCAD, Revit, Chief Architect, SketchUp, Sweet Home 3D and
  QGIS it draws on.
- [`wiring.md`](./wiring.md) — cable routes, the cable journal, the derived
  panel assembly and wall elevations, after a study of MoonCAD.

