# Space Golf — analysis of Gravity Golfing and the technical description of the clone

Reference game: **Gravity Golfing** by Jurien Meerlo (iOS / iPadOS / macOS Apple
Silicon / visionOS, App Store id 1498685589). Released 2023-06-23, last update
1.1.2 on 2023-08-08, 16 MB, free with a single "Support the game" purchase,
rated 4.7 from 239 ratings. Not available for Android or the web — this
document records what the game is, what the two reference screenshots show,
the rules that follow from them, and how the same game would be built as a
feature of this portfolio.

Facts come from the App Store listing, its version history and a player of
the game (the author of this repository); everything read off the
screenshots is marked **observed**, everything deduced is marked **inferred**
with the confidence it deserves.

## 1. What the game is

- Store description, verbatim: *"Infinite golfing in a universe where gravity
  changes when your ball hits a wall. Gravity golfing is a casual golfing
  game. Hit a wall to change gravity and shoot your ball in the hole."*
- Listed features: infinite levels, global leaderboards, achievements.
- Version notes name the content: 1.1.0 added *"Bounce wall areas"* and
  *"Shrinking and growing floating obstacles"*, and fixed *"spawning ball
  inside gravity walls"* — so walls that change gravity are a distinct
  entity, "gravity walls", from ordinary geometry. 1.1.2: *"Change color
  between levels more often"* — the palette is per level.
- Player reception (App Store, TouchArcade thread): quick to pick up,
  relaxing, *"no real fail state"* — a bad shot costs strokes, never the
  level.

## 2. What the screenshots show (observed)

Two portrait frames of the same level, one mid-aim.

**Playfield.** Black space background with faint white stars. A bounded
arena of dark navy blocks with a subtle square-tile texture. Block faces are
lined with a thin gold/beige bevel on some sides only; long thin gold bars
also stand alone inside the arena (three tall vertical ones, several
horizontal ones), forming corridors. Many block corners are cut at 45°,
and so are the ends of the bars — the arena mixes axis-aligned faces with
short diagonal ones. The ball starts at the top of the arena
and the flag is at the bottom left, so the level reads top-to-bottom like a
maze.

**Ball.** A small white disc, a few pixels across. In frame 2 it sits at the
top of the arena with a column of five white dots running straight down from
it — the aim preview.

**Hole.** A round notch cut into a block face — a cup the ball has to roll
into — with a white flag on a pole standing beside it on the same face.

**Hazards.** Gold spikes in rows of three or four on several block faces and
bar ends, both pointing up and pointing down. They have two states: extended
(triangles standing out of the face) and retracted (flat gold nubs flush
with the face, which read as rows of small dots in the wide frames — bottom
left near the flag, top of the arena, the left block). Both states are
present in the same frame, so spikes are not all in phase.

**Pickups.** Small gold shapes scattered in the open space: filled circles,
filled squares, diamonds (rotated squares) in two sizes. Two larger outlined
shapes near the start — a circle inside a ring and a square inside a square —
differ from the pickups and likely belong to the "floating obstacles" family.

**HUD.** Top left, a flag icon with `28023`. Top centre, a golf-club icon with
`215745 +2` in frame 1 and `215745 +0` in frame 2. Top right, two octagonal
buttons: restart (circular arrow) and menu (three lines).

## 3. Rules (inferred from 1 + 2)

| Rule | Confidence | Basis |
|---|---|---|
| **Rubber-band aim from anywhere.** The first touch sets an **anchor** at any point of the screen — the ball is too small to be a target, and there is always room somewhere on the screen to lay out a trajectory. Dragging pulls the band away from the anchor; the shot vector runs **from the current pointer position back to the anchor**, the way a stretched band snaps, and that vector's direction and length are applied to the ball. Release shoots. | confirmed | the player |
| **Five dots drawn from the ball** show the direction and the power of the pending shot while the pull is adjusted. Their spacing is the power: a short pull draws them close together, a long pull spreads them apart. Power is capped at a maximum. | confirmed | the player; frame 2 |
| **Returning the pointer to the anchor cancels**: the band is slack, the dots disappear from the ball, and releasing there plays no stroke. The vanished dots are the signal that the two points coincide. | confirmed | the player |
| Gravity is a direction, not a point. **Whichever horizontal or vertical face the ball touches becomes the floor**: gravity turns to point into that face, and the ball settles on it. Every axis-aligned face does this, the standalone bars included. | confirmed | the player; store text; "gravity walls" in the 1.1.0 notes is what every axis-aligned wall is |
| **Diagonal (45°) faces are plain walls**: the ball bounces off them and gravity stays as it was. They are deflectors that steer a shot from one axis-aligned face to another. | confirmed | the player; the chamfered corners and bar ends in both frames |
| **A horizontal face never meets a vertical one directly.** Every corner, convex or concave, is joined by a 45° cut, so the ball can never sit in a right angle touching two floor candidates at once. | confirmed | the player |
| A stroke therefore moves the ball from one wall to another: it flies, hits a face, that face becomes "down", and the ball comes to rest there. The gold bevel is not a rule marker; it is the lit edge of the palette (bounce areas, if they look different, are still unidentified). | high | follows from the rule above; the frames show bevels on faces the ball never reaches |
| In frame 2 the ball rests against the top block, so gravity points **up**; the dots run straight down because the aim is straight against gravity — the shot decelerates, and a shot across gravity would draw a curve. | medium | geometry of the frame under the rule above |
| Spikes **toggle every stroke**: a row that is extended during this shot is retracted during the next, and vice versa. A retracted row is part of the wall and harmless. | confirmed | the player; both states in one frame |
| Touching an extended spike **destroys the ball**. | confirmed | the player |
| A destroyed ball **reappears at its last resting point** (the tee for the first stroke), with the gravity it had there; the level does not restart. | confirmed | the player |
| The wasted stroke is the cost: it stays in the level's `+N` and in the total, so there is no game over. | medium | "no real fail state"; the `+N` counter in the HUD |
| Gold pickups are worth points (or strokes back); the three shapes may carry different values. | low | nothing in the sources names them |
| The outlined circle/square are the "shrinking and growing floating obstacles": solid bodies whose size pulses over time. | medium | 1.1.0 notes + their distinct look |
| "Bounce wall areas" are faces with high restitution that fling the ball. | medium | 1.1.0 notes |
| `28023` is the level number: levels are endless and the counter is large because a level is short. | medium | "infinite levels", the flag icon |
| `215745` is the total stroke count over all levels; `+N` is strokes on the current level, reset by the restart button (frame 2 is a fresh attempt). | medium | the golf-club icon, the `+2` → `+0` after restart |
| Levels are generated procedurally from a seed; the level number is the seed. | medium | "infinite levels", the bug about spawning inside walls (a generator bug) |
| The ball must **roll into the cup and stay there for at least a second** before the hole counts; the flag pole rises from the centre of the cup. | confirmed | the player |
| **The cup sits on a horizontal or vertical face only**, never on a 45° one: it is cut into a face that can become the floor, which is what makes rolling into it possible at all. | confirmed | the player |
| **The cup is a hole, not a magnet.** It is a rounded notch cut into the face, an ordinary wall with a curved rim: the ball has to roll in; a fast ball hitting the rim bounces out; there is no attraction and no seating. | confirmed | the player |
| **The board is open.** Nothing walls it in: the blocks at the edge are cut by the screen and the ball can leave through any gap. A ball out of sight for more than three seconds bursts and reappears at its last rest point. | confirmed | the player; second recording |
| **The cup must be reachable.** Every level guarantees that the ball can be rolled into the hole under the rules above: there is a sequence of strokes that brings the ball onto the cup's face with it as the floor and rolls it in. | confirmed | the player; the "main rule" of the design |

## 4. Technical description for a web version

A 2D physics puzzle with a handful of primitives; nothing in it needs the
GPU. The design below follows the repository layering
(`domain → application ← infrastructure`, `presentation` on top) so the rules
are pure and testable and the rendering is replaceable.

### 4.1 Domain (framework-free, unit-tested)

**Units.** Metres and seconds in the model; one level is a 9 × 16 metre
portrait board (the screenshot aspect) so the render scale is one number.

**Level model** — plain data, immutable. A wall is a convex polygon whose
edges are either axis-aligned or at 45°, which is exactly what the
reference draws: blocks with chamfered corners and bars with pointed ends.
Collision is circle-versus-segment, the same routine for both edge kinds;
the edge's orientation decides whether it is a floor candidate.

```ts
interface Level {
  readonly seed: number;            // = level number
  readonly size: { w: number; h: number };
  readonly walls: readonly Wall[];  // convex polygons, edges at 0°/90°/45°
  readonly spikes: readonly SpikeRow[]; // a face segment + initial phase
  readonly pickups: readonly Pickup[];
  readonly floaters: readonly Floater[]; // pulsing circle / square
  readonly tee: Vec2;
  /** A notch cut into one floor edge (never a deflector); the ball rolls in along that edge. */
  readonly cup: { wall: number; edge: number; at: number; radius: number };
  readonly palette: Palette;        // per-level colours (1.1.2)
}
interface Wall {
  /** Counter-clockwise vertices; every edge is horizontal, vertical or diagonal. */
  readonly vertices: readonly Vec2[];
  /** Per edge, by index of its first vertex. */
  readonly faces: readonly FaceKind[];
}
/**
 * `floor`: an axis-aligned face — touching it turns gravity into it.
 * `deflector`: a 45° face — reflects only, gravity is untouched.
 * `bounce`: an axis-aligned face with a stronger rebound (1.1.0), floor rule included.
 * The kind is derived from the edge's orientation when the level is built,
 * so a diagonal edge can never be a floor by mistake.
 */
type FaceKind = 'floor' | 'deflector' | 'bounce';

interface SpikeRow {
  readonly wall: number;          // index into `walls`
  readonly edge: number;          // the floor edge the row sits on
  readonly from: number;          // start and length along the edge, metres
  readonly length: number;
  /** State during stroke 1; it flips with every stroke after that. */
  readonly extendedOnOddStrokes: boolean;
}
```

**Ball state** — the only mutable thing, replaced per step:

```ts
interface BallState {
  readonly position: Vec2;
  readonly velocity: Vec2;
  readonly gravity: Vec2;   // unit vector × g; changes on floor-face hits
  readonly phase: 'aiming' | 'flying' | 'destroyed' | 'holed';
  /** Where and under which gravity the ball last came to rest — the respawn point. */
  readonly rest: { readonly position: Vec2; readonly gravity: Vec2 };
  /** Strokes played on this level so far; spike rows read their state from its parity. */
  readonly stroke: number;
}
```

`isExtended(row, stroke) = row.extendedOnOddStrokes === (stroke % 2 === 1)`
is the whole spike clock: nothing animates on a timer, the state changes
the moment a stroke is played and stays until the next one, so a ball
resting under a retracted row is safe until the player shoots again.

**Physics** — `step(level, ball, dt): BallState`, fixed `dt` (1/120 s, two
sub-steps per 60 Hz frame) so the aim preview and the real flight are the
same computation:

- semi-implicit Euler: `v += gravity·dt; p += v·dt`;
- circle-vs-segment continuous collision along the step (swept), because
  a fast ball must not tunnel through the thin bars: find the earliest edge
  hit within the step, move to it, reflect, continue with the remaining time
  (at most a few iterations per step); vertices are handled as the two
  adjacent edges, so a chamfer needs no special case;
- on a **floor** face hit: `gravity = −normal × g` — the face becomes the
  floor — then reflect the normal velocity component with restitution
  ≈ 0.4 and apply tangential friction, so the ball hops once or twice and
  settles on the face it hit; `bounce` faces use a restitution above 1
  capped to a max speed and still turn gravity, so the ball is flung and
  then falls back onto that face;
- on a **deflector** (45°) hit: reflect with restitution ≈ 0.8 and leave
  gravity alone — the ball carries on under the old gravity towards
  whichever axis-aligned face the deflection sends it to; a ball can slide
  along a deflector under gravity but never rests on one, since gravity
  is never perpendicular to it;
- a corner hit resolves against the edge reached first along the swept
  path (ties: the edge the velocity points into more), and only a floor
  edge turns gravity; a chamfered corner therefore never flips gravity
  where a sharp one would have;
- rest detection: speed under a threshold while in contact with the floor
  face for ~0.3 s → `aiming`; because gravity always points into the face
  last hit, a ball can never rest on a face gravity points away from;
- the floor and the stroke parity are part of the state the preview must
  carry: the dotted line is computed with the same `step` at `stroke + 1`,
  so it shows the ball dropping onto the wall it will hit and stops at a
  spike row that will be extended during that shot; the renderer draws the
  rows in the state of the *upcoming* stroke while aiming, which is what
  the reference frames show;
- spikes: an **extended** row is a hazard segment lifted off its edge by
  the spike height — touching it → `destroyed`: the flight ends, a short
  burst animation plays, and the ball reappears at `rest` — the position
  and gravity of its last resting point, the tee on the first stroke — in
  `aiming`. The stroke that was played counts, the level goes on, and the
  spike rows keep flipping with the stroke parity, so after a destroyed
  shot the row that killed the ball is retracted for the next one — the
  natural rhythm of the puzzle; a **retracted** row is inert and the ball
  lands on the edge underneath it like on any floor face;
- `rest` is updated whenever the ball settles on a floor face, so a shot
  that lands safely moves the respawn point forward and a destroyed shot
  never sends the player back further than one stroke;
- the stroke counter increments when the shot is released, before the
  first `step`, so the spike states the preview showed are the ones the
  flight meets;
- floaters: their radius follows `r(t) = r0 + a·sin(ωt)`; collide as circles
  or squares, plain restitution;
- cup: the notch is real geometry — an arc cut out of a floor edge, and
  building a level asserts that the edge is axis-aligned, so a 45°
  deflector can never carry the cup — so the ball only enters it when
  gravity points into that edge (the edge is its floor) and it rolls or
  drops in: its centre inside the notch **and** its speed under the capture
  threshold seats it in the notch. Seated, it is not at rest for the
  player — no stroke can be played — and a clock runs: after one second in
  the cup the level is `holed`. A fast ball crosses the notch and carries
  on, and a ball on the opposite floor passes the notch as a bump in the
  ceiling — the cup is a hole in a floor, not a hole with suction.

**Shot** — the pointer-down position is the `anchor`, the current pointer
position the `pull`; the band vector is `anchor − pull`, and
`aim(anchor, pull): Vec2 | undefined` maps it to the initial velocity
`v = (anchor − pull) × k`, clamped to `MAX_SPEED`, or to nothing when
`|anchor − pull|` is under the dead zone — the slack band. Neither point has
anything to do with where the ball is; the vector is simply applied to it.
`preview(level, ball, velocity)` runs `step` for
`PREVIEW_DOTS = 5` samples taken every `PREVIEW_INTERVAL` seconds
(≈ 0.05 s) and returns the five positions. Because the samples are at fixed
time intervals, their spacing is the speed: a gentle pull packs the dots
together, a strong pull spreads them, and past `MAX_SPEED` the spacing stops
growing — the cap is visible without a separate gauge. The dots start at
the ball and follow the real simulation, so under gravity across the shot
they bend, and a dot that would land inside a wall or an extended spike row
is clamped to the hit point (the reference shows only the initial
trajectory, five dots is short enough that this rarely matters). While the
band is slack there are no dots and no shot: `aim` returns nothing, the
renderer draws nothing from the ball, and release ends the gesture
silently.

**Generator** — `generateLevel(seed): Level`, deterministic from a seeded
PRNG (`alea` is already in the catalog):

1. carve a corridor from tee (top band) to cup (bottom band) on a coarse
   grid, then thicken the walls around it into blocks; the cup is cut into
   the floor edge the corridor ends on, and the last hop of the plan lands
   on that edge — the ball arrives with the cup's face as its floor, which
   is the reachability rule made structural;
2. plan the corridor as a chain of **landing faces**: each hop is one
   stroke from the face the ball rests on to the next face it must land on,
   which then becomes the floor; a hop is valid when a shot within the max
   speed reaches the target face without crossing a spike, so the corridor
   is solvable by construction; chamfers on the corners the corridor bends
   around act as deflectors that make the bends shootable, plus a few
   bounce faces elsewhere for variety;
3. scatter pickups along and beside the corridor, spike rows on dead ends
   and on some corridor faces with the phase chosen so the row is retracted
   on the stroke the plan lands there — a row that is extended on that
   stroke is the puzzle: the player must spend a stroke elsewhere (or
   bounce once more) to flip it; one or two floaters in open pockets;
4. reject and re-roll a seed whose tee or cup lands inside a wall (the bug
   fixed in 1.1.0) or whose corridor is shorter than a minimum;
5. palette = seed-derived hue pair (navy/gold in the reference).

Reachability of the cup is the invariant the generator exists to keep:
it is guaranteed structurally by steps 1 and 2, not by search, and a
`solvable` test replays the generator's own planned strokes through the
real physics for a batch of seeds — every replay must end `holed`. A seed
that fails the replay is a generator bug, not a hard level.

**Scoring** — `strokesTotal`, `strokesThisLevel`, `levelNumber`, pickup
points; persisted per player. Leaderboards and achievements are out of scope
for the portfolio (no backend), a local best-per-level table replaces them.

### 4.2 Application (MobX)

- `GravityGolfStore` (root, `dispose()`): `level`, `ball`, `strokes`,
  `phase`, `nextLevel()`, `restart()`; owns a fixed-step game loop
  (`requestAnimationFrame` with an accumulator) that advances `ball` while
  `phase === 'flying'`, and on `destroyed` plays the burst and returns the
  ball to its `rest` point (the HUD's restart button is the different,
  full reset: tee, stroke count and spike phases); exposes `previewPath`
  for the current drag.
- `ProgressModel`: level number, totals, best strokes per level,
  persisted through a `ProgressRepository` port (IndexedDB in
  infrastructure, memory in tests), like the other features' repositories.
- `InputModel`: pointer down sets the anchor, move updates the pull, up
  releases; all in board metres; the dead zone around the anchor is the
  cancel — dragging back to it and releasing plays nothing.

### 4.3 Infrastructure

- **Rendering**: Canvas 2D through the existing `useAmbientCanvas` hook —
  rectangles, bevels, spikes, dots and a disc do not justify a WebGPU
  pipeline; the hook already gives DPR handling, visibility pause and the
  reduced-motion frame. Draw order: stars → blocks → bevels → spikes →
  pickups → floaters → cup and flag → ball → preview dots → HUD is DOM.
- **Input**: pointer events on the canvas, `touch-action: none`, one active
  pointer, anchor anywhere — the ball is a few pixels and a thumb would
  hide it; the band vector is current position → anchor in board metres; a
  dead zone of a few pixels around the anchor is both the cancel gesture and
  the guard against an accidental tap.
- **Audio**: a few synthesised WebAudio hits (wall, spike, pickup, cup),
  muted until the first gesture; the reference's 1.1.2 fix shows hit sounds
  matter to the feel.
- **Persistence**: `idb` store `gravity-golf` with `progress` and
  `bestByLevel`.

### 4.4 Presentation

- Route `gravity-golf` in `routeMetadata.ts`, lazy like the other games,
  under `InnerRoot`.
- HUD as DOM over the canvas: level number with a flag glyph, total strokes
  with the current level's `+N`, restart and menu buttons (octagonal, as in
  the reference), a level-complete overlay with strokes and "next".
- Translations `en`/`ru`; the game itself has no text on the board.
- Portrait board letterboxed inside the viewport; on desktop the board is
  centred at a fixed aspect, keyboard `R` restarts.

### 4.5 Tests as the specification

- physics: reflection on each face kind, gravity flip on floor faces and
  none on deflectors, no tunnelling through a 0.1 m bar at max speed,
  rest detection, a ball sliding off a deflector under gravity, cup capture
  only at rest, spike rows flipping with the stroke parity, a retracted
  row acting as plain floor, an extended row destroying the ball and
  bringing it back to its last resting point with that point's gravity,
  the wasted stroke counted and the rows flipped;
- generator: determinism per seed, tee and cup never inside a wall, the cup
  sits on a horizontal or vertical edge and a level with it on a deflector
  is rejected at construction, the corridor exists, and the planned strokes replay
  to `holed` for a batch of seeds — the reachability guard;
- shot: velocity runs from the pull point to the anchor with the band's
  length as power, clamp at `MAX_SPEED`, nothing inside the dead zone;
  preview is exactly five dots from the ball at fixed intervals of the real
  flight, dot spacing grows with the pull and saturates at the cap, and no
  dots when the band is slack;
- store: phase transitions, strokes accounting across restart and next
  level, persistence round trip.

### 4.6 Performance and size

Fixed-step physics with swept circle-vs-AABB over a few dozen rectangles is
microseconds per step; the preview simulates 2–3 s ahead on every pointer
move, still under a millisecond. No assets beyond the two Unicode glyphs
for the HUD; the feature chunk stays small and lazy.

## 5. Open questions

1. ~~The exact gravity rule.~~ Settled: a horizontal or vertical face the
   ball touches becomes the floor; 45° faces only bounce. Still open:
   whether a shot that grazes a floor face at a shallow angle turns gravity
   too, or only a hit above some normal-speed threshold.
2. What pickups do: score, strokes back, or nothing but cosmetics.
3. ~~The spike penalty.~~ Settled: the ball is destroyed and comes back to
   its last resting point. Still open: whether a fixed penalty is added on
   top of the wasted stroke.
4. Whether floaters kill or bounce, and whether bounce areas are faces or
   zones.
5. Whether `28023` is the level number or the score and `215745` the total
   strokes — swap the HUD semantics if a play session shows otherwise.

Each of these is a constant or a one-line rule in the domain; the design
does not change with the answer.

## Sources

- App Store listing and version history: https://apps.apple.com/us/app/gravity-golfing/id1498685589
  and https://apps.apple.com/gb/app/gravity-golfing/id1498685589
- TouchArcade game page: https://toucharcade.com/games/gravity-golfing
- TapTap listing: https://www.taptap.io/app/33574307
- Gameplay video: https://www.youtube.com/watch?v=ziPQaqKSnak

## 6. As built (2026-09-08)

The feature lives in `apps/portfolio/src/features/space-golf` and follows §4
with these deviations and decisions:

- **Solvability is proven by search, not by construction.** The generator
  lays out blocks with a connectivity guard (`generator/layout.ts`), places
  the cup on an exposed horizontal or vertical face and the spike rows on
  others (`generator/place-features.ts`), then `generator/solver.ts` plays
  the level with the real physics — a fan of 48 strokes from every rest
  state, best-first towards the cup — and the layout is accepted only when
  it holes out in 2–6 strokes. The stroke count is the par. Generation takes
  40–650 ms per seed and runs in a worker (`infrastructure/level-worker.ts`)
  with the next level prefetched while the current one is played.
- **Walls are convex polygons** with edges at 0°, 90° or 45°; the face kind
  is derived from the edge orientation (`domain/walls.ts`), so a diagonal can
  never be a floor. Blocks are one-metre cells merged into rectangles; every
  free convex corner is chamfered and every concave junction (block to block,
  block to frame, the frame's own corners) gets a triangular 45° fillet, so
  no reachable corner is a right angle; layouts where two blocks touch only
  at a corner are rejected.
- **Physics** (`domain/step.ts`): swept circle-versus-segment with rounded
  corners, at most four contacts per 1/120 s step, restitution 0.4 on floors,
  0.8 on deflectors, impact friction only on impacts, rolling damping in
  contact and a light air drag. A floor face turns gravity into itself; a
  corner or a deflector reflects only. Rest after 0.3 s under 0.2 m/s.
- **Spike rows** flip with the stroke parity; an extended row is a hazard
  segment lifted by the spike height; touching it destroys the ball, which
  reappears at its last rest point after a 0.45 s burst; the stroke counts.
- **Cup** (`domain/cup.ts`): `carveCup` replaces the metre under the flag by
  an eight-segment half-disc of `cup` faces — walls with a curved rim that
  the ball can rest on and that leave gravity alone. The ball is in the cup
  when its floor is the cup's face, it lies on a rim segment near the
  centre and it is slow; after one second there the hole counts. A fast
  ball meets the rim like any wall and flies out. The flag pole rises from
  the cup's centre; the block fill is triangulated with earcut because the
  notch makes the polygon concave.
- **Open board** (second recording, §8): there are no frame walls; a block
  touching the board's edge bleeds one metre past it (`EDGE_BLEED_METERS`)
  and keeps no chamfer there; the board's edge makes no fillet. `step`
  counts the seconds the ball is wholly beyond the board and destroys it
  after `OFFSCREEN_LIMIT_SECONDS` (3), or at once if it would come to rest
  out there; the solver inherits the rule, so a level whose only route
  leaves the screen is rejected.
- **Elastic bars** (`generator/place-bars.ts`): 0–3 bars, 0.12 m thick,
  two to four cells long, along a row or column of empty cells; each grows
  out of a block face (joined by 45° fillets) or in from the board's edge,
  the far end free (chamfered) or joined. Every straight face is `bounce`;
  an elastic face rebounds from 0.25 m/s instead of 0.8, so the ball still
  settles on it after a few hops. Drawn solid in the rim colour.
- **Pickups** (`generator/place-pickups.ts`, `domain/pickups.ts`): 3–8 per
  level in the middle of empty cells nothing else uses — diamond, square
  or ring, 0.16 m; the ball collects one by touching it, keeps its
  collection through a burst and loses it on a restart. The HUD counts
  collected / total; nothing else depends on them yet.
- **Aim ring**: while the band is held a thin ring of 0.9 m is drawn round
  the ball, as in the original.
- **Aim**: anchor anywhere, velocity = (anchor − pull) × 6 m/s per metre,
  capped at 14 m/s, dead zone 0.15 m; five preview dots at 50 ms intervals
  from the real simulation.
- **Rendering**: one WebGPU pass (`infrastructure/layers/board-layer.ts`),
  flat-coloured triangles in board metres; the level's stage and its two
  spike-parity meshes are uploaded once, the ball, dots and burst every
  frame; letterboxed 9 × 16 board (`render/board-viewport.ts`).
- **Not built yet**: pulsing floaters, the sticky and viscous surfaces,
  the tile texture on blocks, per-level palettes, sound, a menu.

## 7. From the recording (2026-09-08)

A 115 s screen recording of the original (384 × 848, 30 fps, levels 28023
and 28024) was cut into frames; the ball was tracked as the small white
blob and its per-frame velocity analysed. Scale: the arena is 363 px wide
and is taken as the 9 m board, so 1 m ≈ 40 px.

**Measured constants** (now in `domain/constants.ts`):

| Quantity | Recording | In board units |
|---|---|---|
| Gravity (free flight, both up and down) | ≈ 275 px/s² | 6.8 m/s² (`GRAVITY` = 7) |
| Fastest flight seen | ≈ 376 px/s | 9.3 m/s (`MAX_SPEED` = 10) |
| Ball | ≈ 5 px across | radius 0.06 m (`BALL_RADIUS` = 0.07) |
| Normal restitution, plain faces and corners | 0.3 – 0.5 | `FLOOR_RESTITUTION` 0.45 |
| Normal restitution, thick gold bars | ≈ 0.75 (four bounces in a row: 0.73, 0.74, 0.55, 0.78) | `BOUNCE_RESTITUTION` 0.75 |
| Tangential speed kept on a wall hit | ≈ 0.5 | `CONTACT_FRICTION` 0.55 |
| Spike height | ≈ 4–5 px | 0.12 m |

**Gravity change timing.** On the ball itself the switch is immediate: in
every recorded wall hit the acceleration along the old gravity stops and
the one along the new gravity is fully there within one or two frames
(≤ 0.07 s) — e.g. a fall at 900 px/s onto a face at frame 1432 turns into a
rightward roll accelerating at the full ≈ 250 px/s² from the next frame.
The half-second the player perceives is the background dust: it drifts
along gravity and its direction eases round after a change. Built as such:
physics switches at once, the dust turns at a half turn per 0.5 s
(`infrastructure/render/particles.ts`).

**Confirmed by the recording:** a corner hit reflects and leaves gravity
alone (frame 741); retracted spike rows are passed over as plain faces
(frame 765, the ball touched a face whose row was retracted); the ball
rests wherever it stops, not only on horizontal faces.

**Elements seen** (montage of the impact sites and the board):

- *Half-disc bumps* on faces (gold domes): the ball bounced off them at
  ≈ 0.5 — a distinct surface, semantics still open (the player calls some
  surfaces sticky, viscous and elastic).
- *Thick gold bars* along faces: the elastic ones (0.75), built as the
  `bounce` face kind with a thicker rim; the generator places 0–2 per level.
- *Thin gold bars*: ordinary walls.
- *Large outlined shapes* (diamond, circle, square with a gold rim): solid
  floating obstacles the ball bounces off (frames 1253, 1432) — the
  "shrinking and growing" ones of the 1.1.0 notes. Not built yet.
- *Small filled gold shapes* (diamond, disc, square): pickups. Not built yet.
- *Sticky*: at frame 2335 the ball hit a large filled gold diamond at
  190 px/s and lost 94 % of its normal speed, then crept to a stop —
  the best candidate for the "sticky" surface. Not built yet.
- *Dashed rows* on faces are retracted spikes; the palette changes per level
  (28023 navy/gold, 28024 navy/lime).

**Open after the recording:** which visual is "viscous"; whether pickups
change the score; the exact power-to-pull ratio (the finger is not in a
screen recording, `BAND_SPEED_PER_METER` = 5 stays a guess).

## 8. From the second recording (2026-09-08)

A 275 s recording (384 × 848, 30 fps, levels 28025–28033, nine levels)
was cut into frames at 2 fps and read as contact sheets and full frames.
What it adds to §7:

**The world is open.** Every level fills the screen and its blocks are
cut off by the screen's edge — there is no frame. The ball can be shot
off the screen through any gap; per the player it bursts after three
seconds out there and comes back to its last rest point. Built as the
open board of §6.

**Elements catalogue** (all nine levels):

- *Blocks*: dark tiled bodies of arbitrary orthogonal shape, every
  convex corner cut at 45°, some with long diagonal faces; a lighter rim
  along the exposed edges.
- *Thin bright bars* (0.1–0.15 m thick, 2–4 m long): free-standing
  platforms growing out of a block face or in from the screen's edge,
  sometimes bridging two blocks; the ball bounces off them briskly —
  the "elastic" surface. Built as `bounce` bars.
- *Spike rows*: rows of two to five teeth on a face, extended or retracted;
  the retracted state is a row of low nubs.
- *Pickups*: three shapes floating in the open — a filled diamond, an
  outlined square with a dot, a ring with a dot — plus very small dots;
  they are not walls (the ball passes through their cells). Built with
  the three shapes; the small dots are not.
- *The cup*: a small round notch in a horizontal or vertical face with a
  flag standing on the face beside it; in the frames the flag is drawn
  from the notch.
- *Aim ring*: while the finger is down a thin circle of ≈ 0.9 m radius is
  drawn round the ball; the five dots run from the ball. Built.
- *HUD*: top left a flag with the level number (28025 …, one per level);
  top centre a golf-club icon with the total strokes and `+N` for the
  current level — the total grows by exactly the level's `+N` when it is
  completed (215765 → 215776 after a level of 11 strokes), so the counter
  is strokes, not points; top right a restart and a menu button.
- *Palette*: the block colour shifts per level from purple through maroon
  to brown, the rim from lime to mint; the dust stays white.
- Nothing pulsing, sticky or viscous is visible in this recording; the
  large outlined shapes of §7 do not appear.

**Not seen either time:** what the pickups are worth — the stroke counter
does not react to them.
