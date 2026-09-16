# Space Golf

A gravity-flipping golf puzzle after Gravity Golfing, with its own physics and procedural Khokhloma-painted levels.

Live: [https://frozik.github.io/portfolio/space-golf](https://frozik.github.io/portfolio/space-golf) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/space-golf/`.

A golf puzzle in space, after the iOS game Gravity Golfing: whichever
horizontal or vertical wall the ball touches becomes the floor, 45° cuts
only bounce it, and the cup must be reached by chaining walls. Rendered
with WebGPU, physics written for the game (`features/space-golf/domain`).
Reset to the essentials on 2026-09-14 — the field and the ball — to get the
rendering and the feel right first; the cup is back, spikes, elastic bars,
pickups and the solvability guarantee are on the way one at a time.

- Press anywhere and pull the rubber band; five dots in a straight line
  from the ball show the direction and the power of the impulse, not the
  flight — the bend under gravity is for the player to judge; returning to
  the anchor cancels the stroke
- Gravity does not flip at the hit: the pull travels from where it was to
  the new floor in half a second whatever the angle, so a reversal passes
  through weightlessness and a ball that touched a ceiling sags off it
  before it is drawn back up; the dust drifts along the very same pull, so
  the field shows the turn as it happens
- The board is open space: blocks at the edge run on past it, a ball can
  fly off — it bursts the moment it leaves unless gravity brings it back
  within three seconds, and reappears where it last rested; the cup is a real rounded notch, two ball widths across, that the ball has to roll into —
  a fast ball bounces off its rim — and holing out adds the strokes to a
  running total kept with the level in IndexedDB
- Long, deep faces carry a stretch of elastic or viscous surface, drawn
  so the outcome is readable before the stroke: a taut shimmering gold
  membrane between two posts keeps the ball hopping, a dark dripping goo
  swallows the impact and holds it
- Levels are endless and procedural on a half-metre grid: each seed
  scatters ten to fourteen islands of L, T, U, Z and stair shapes around a
  tee shelf, a metre of space between them and under a third of the board
  solid, every corner cut at 45° and some by a long diagonal, every empty
  cell reachable from the tee; each island is one polygon with a
  continuous rim, its body painted with a procedural Khokhloma pattern in
  a fragment shader; the HUD steps to the previous and next level and the
  current one is kept in IndexedDB
