# OSM Map

Own WebGPU slippy-map engine over OSM tiles: a tilted camera with fog, quadtree LOD that mixes tile zooms in one frame, tiles fading in over a checkerboard as they load, OSM buildings rising as boxes and cars driving the streets at street zoom.

Live: [https://frozik.github.io/portfolio/osm-map](https://frozik.github.io/portfolio/osm-map) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/osm-map/`.

A Google/Yandex-maps-like viewer written from scratch on WebGPU over the
OpenStreetMap standard raster tiles. No MapLibre, no Leaflet: the camera,
the tile walk, the loading and the drawing are all in this feature. Labels
are out of scope by design — it is a raster-tile engine, not a cartography
stack; the one piece of vector data it reads is building footprints, for
the boxes that stand on the raster ground at street zoom.

## What it does

- **Perspective camera** over the Web Mercator plane: pan, zoom around the
  cursor, rotate and tilt up to 65°. Left drag pans by grabbing the ground
  (the point under the pointer stays under it); wheel and pinch zoom around
  the cursor; the right button or Ctrl+drag turns and tilts; on touch two
  fingers tilt by dragging and turn by twisting. Pans coast with inertia.
- **Fog** dissolves the far ground into the sky colour, and the projection's
  far plane sits where the fog is opaque, so the cut-off is never visible.
- **Quadtree LOD** every frame: the tile tree is walked from the root, culled
  by the frustum and the fog, and a tile subdivides while its projected edge
  exceeds a threshold in device pixels. Near the camera that yields fine
  tiles, toward the horizon coarse ones, all in one frame. Retina displays
  get one zoom level deeper. A per-frame budget coarsens the threshold when
  a 4K screen at full tilt would ask for too many tiles, and a sustained
  low frame rate halves the detail for the session.
- **Progressive loading**: tiles that have not arrived show a procedural
  dark/light checkerboard whose cells encode the pending zoom level — or a
  picture borrowed from the cache, see below; each tile fades in the moment
  its own image lands, nearest first, so the map develops from the camera
  outward.
- **One draw call**: every visible tile is an instance of one quad; the
  images live in a mip-mapped `texture_2d_array` sampled with 16× anisotropy
  so grazing angles do not shimmer. The atlas grows by doubling and evicts
  the least recently used tile at its ceiling; the per-frame tile budget of
  256 never exceeds the ceiling even on a device stuck at WebGPU's default
  layer limit — a 5K display straight down is drawn one level coarser
  instead.
- **Two cache tiers**, on the pattern of the timeseries demo: the atlas is
  the fast one — it grows until its ceiling and then evicts the least
  recently used tile — and asks the device for up to 1024 array layers (a
  full turn of the camera at maximum tilt on a retina display passes about
  770 distinct tiles through the frame). The slow one is IndexedDB: the
  encoded PNGs of the last 1000 tiles asked for, each row keyed by the tile
  and stamped with its last access time; a write past the ceiling deletes
  the rows read least recently. A tile that scrolls back into view is
  decoded again but never fetched again, appears without a fade-in, and
  survives a reload. The browser's HTTP cache remains underneath, kept to
  OSM's headers.
- **Borrowed pictures while loading**: an R-tree (`rbush`) indexes the
  atlas-resident tiles by ground extent. A tile still loading shows the
  matching sub-rectangle of its nearest cached ancestor, and when it lands
  it fades in over that picture; with no ancestor cached, cached descendants
  are laid over the checkerboard as extra quads, within the frame's quad
  budget (every selected tile keeps its quad; descendants fill the rest).
  The checkerboard remains only where the cache has nothing to offer.
- **Loading honours the OSM tile policy**: only tiles in view are requested
  (no prefetch ring), at most six at a time, from the screen centre
  outwards (each tile is ranked by how far its centre lands from the
  middle of the canvas). A request whose tile leaves the frustum is allowed
  to finish — the bytes are half-way here and the tile tends to come back —
  but gives up its slot the moment a tile in view is waiting for one. The
  same ranking orders atlas recency, so the tiles around the centre are
  evicted last. Failures back off before a retry; the browser cache keeps
  the server's headers; the credit is always on screen.
- **Compass** in the top-right corner turns with the map; pressing it turns
  the map back so north is up, keeping the place, zoom and tilt.
- **URL hash** `#zoom/lat/lon/bearing/pitch` mirrors the view (written a
  moment after the camera rests, and only once you have moved the map — a
  pose nobody chose stays out of the URL so the next visit still asks where
  you are) so a link reproduces it. Without a hash the
  map opens where it last found you (remembered in web storage; central
  Osaka at street level on a first visit) and asks the browser for your position, jumping there once
  the fix arrives unless you have already moved the map. The button under
  the compass asks again on demand and centres the map on you, keeping the
  zoom and the tilt.
- **Buildings as boxes** from zoom 16: every footprint in view rises to its
  OSM height over the raster ground. The footprints come from
  [OpenFreeMap](https://openfreemap.org)'s planet vector tiles (OpenMapTiles
  schema, `building` layer at z14 with `render_height` / `render_min_height`;
  free, keyless, no own tile pipeline). The z14 ancestors of the raster tiles in
  view go through the same schedule, priority and IndexedDB tier as the
  pictures (a second `TileLoader` over a mesh cache instead of the atlas); a
  worker decodes the tile and boxes every footprint into one compact mesh per
  tile: each ring vertex twice, base and roof, as `int16` tenths of a metre
  from the tile corner, no normals — the shader derives flat normals from
  screen-space derivatives. A dense city tile (central Osaka) is 120–220k
  triangles and 2–4 MB this way, a third of what per-face vertices cost. The
  building layer draws each tile with an offset and a metres-to-map-units
  scale taken at the tile's latitude, lit by a fixed sun and fogged like the
  ground, into its own depth buffer: the ground never writes depth because
  every box stands above it. Meshes are kept on the GPU up to a byte ceiling
  (128 MB), least recently drawn first out, and a picture asks for at most
  sixteen street tiles, nearest the screen centre first, so the tiles in
  view always fit the cache and never evict each other. Whether buildings show
  is decided once for the whole picture, with a gap between showing (z16)
  and hiding (z15.5) so hovering at the threshold never flickers them; the
  street tiles are the z14 tiles under every raster tile from z14 down to
  the fog, so a tile near the horizon does not blink as the camera turns. A
  tile standing for the first time grows out of the ground over 0.6 s
  (ease-out, in the vertex shader) and keeps that moment until buildings are
  hidden, so a tile drifting out of the picture and back does not regrow.
  No roofs, parts or labels — the deferred stage 2 plan covers those.
- **Cars on the streets** from zoom 17. The same z14 tile carries the
  `transportation` layer; the worker cuts every drivable road (`motorway`
  … `service`, tunnels left out) to the tile square and keys each vertex
  on a grid shared by all tiles, so the roads of every tile in the picture
  join into one street graph: a vertex two lines share is a junction, and
  the same road crossing a tile border is a junction too. A car follows its
  road; at a junction it keeps straight 70% of the time and otherwise turns
  onto a random other road (never a U-turn); at a dead end inside the map
  it turns around; it is gone only when it drives off the edge of the loaded
  roads, and another car comes in at such an edge to replace it. Right-hand
  traffic: on a two-way road a car keeps 1.75 m to the right of the centre
  line. Junctions are safe: a car about to enter one waits at its edge while
  a car from another road is inside it or about to arrive from the right
  (priority to the right), and gives up waiting after 3 s so four polite
  cars never lock each other up; on its own road it never closes on the car
  ahead. Cars are seeded when a tile enters the picture, deterministically
  from the tile key, sparser than the real thing — busiest on main roads,
  nearly none on service roads — with five procedural body shapes (sedan,
  hatchback, crossover, van, bus on bus-class roads only) and a ten-colour
  fleet palette. One instanced draw per body in the street pass, with the
  tile's placement, lit and fogged like the boxes and occluded by them.
  While cars are in the picture the loop runs at 30 fps rather than idling;
  they appear at z17 and go at z16.5, and below that the map rests as
  before.
- **Render on demand**: at rest, with nothing in flight and no fade running,
  no frame is submitted and the loop idles at 10 fps.

## How it is built

`domain/` is pure and unit-tested: Mercator maths, the immutable camera
(`map-camera.ts`), frustum planes, the tile walk (`tile-selection.ts`), the
tile schedule (`tile-schedule.ts`, the one owner of what every tile is
doing), the street tiles — building footprints, road lines, the street graph, car
bodies, the traffic simulation and the z14 selection
(`building-footprint.ts`, `road-lines.ts`, `street-graph.ts`,
`car-bodies.ts`, `car-traffic.ts`, `street-tile-selection.ts`) — the detail
budget and the hash format. `infrastructure/` owns WebGPU and the network:
the atlas with its staging mip chain, the generic loader, the two tile
sources, the street tile worker and cache, the ground and street layers with
their shaders, the gesture controller and the hash sync.
`application/render/map-scene.ts` runs the per-frame pipeline — camera →
visible tiles → loads → instances, street placements and cars — and hands
the layers a frame only when something changed; `street-traffic.ts` keeps
the moving cars between frames; `run-osm-map.ts` is the composition root. The
MobX store holds only the compass bearing and the locate state; the camera
never touches MobX because it changes every frame.

Two details worth knowing before changing the renderer:

- The GPU only ever sees positions **relative to the camera target**. A
  float32 world coordinate near 0.6 is good to about 6e-8, a few percent of
  a zoom-19 tile, which would jitter; the walk and the camera stay in
  float64 and the view-projection is built around the target.
- The fragment shader samples the atlas for every tile, placeholder or not,
  and mixes the checkerboard in by weight: `textureSample` must sit in
  uniform control flow, so it cannot be skipped per instance.

Known limits: tile seams can show as hairlines at grazing angles (the
tiles have no gutters, the same as any raster basemap); the world does
not wrap at the antimeridian; there are no labels of its own — the ones
you see are baked into the raster tiles and tilt with them.
