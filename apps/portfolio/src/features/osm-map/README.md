# OSM Map

Own WebGPU slippy-map engine over OSM tiles: a tilted camera with fog, quadtree LOD that mixes tile zooms in one frame, tiles fading in over a checkerboard as they load, OSM buildings rising as boxes at street zoom.

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
  map opens where it last found you (remembered in web storage; Moscow on a
  first visit) and asks the browser for your position, jumping there once
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
  worker decodes the tile and extrudes every footprint with
  `@frozik/utils/geometry/extrudeFootprint` into one mesh per tile, in metres
  from the tile corner. The building layer draws each tile with an offset and
  a metres-to-map-units scale taken at the tile's latitude, lit by a fixed sun
  and fogged like the ground, into its own depth buffer: the ground never
  writes depth because every box stands above it. Meshes are kept on the GPU
  up to a byte ceiling, least recently drawn first out. A tile entering the
  picture grows out of the ground over 0.6 s (ease-out, in the vertex
  shader), whether it just landed or came back from the cache; leaving and
  returning grows it again. No roofs, parts or labels — the deferred stage 2
  plan covers those.
- **Render on demand**: at rest, with nothing in flight and no fade running,
  no frame is submitted and the loop idles at 10 fps.

## How it is built

`domain/` is pure and unit-tested: Mercator maths, the immutable camera
(`map-camera.ts`), frustum planes, the tile walk (`tile-selection.ts`), the
tile schedule (`tile-schedule.ts`, the one owner of what every tile is
doing), the building footprints and their z14 selection
(`building-footprint.ts`, `building-tile-selection.ts`), the detail budget
and the hash format. `infrastructure/` owns WebGPU and the network: the
atlas with its staging mip chain, the generic loader, the two tile sources,
the mesh worker and cache, the ground and building layers with their
shaders, the gesture controller and the hash sync.
`application/render/map-scene.ts` runs the per-frame pipeline — camera →
visible tiles → loads → instances and building placements — and hands the
layers a frame only when something changed; `run-osm-map.ts` is the
composition root. The
MobX store holds only the HUD readout and the reset command; the camera
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
