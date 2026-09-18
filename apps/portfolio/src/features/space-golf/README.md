# Space Golf

A gravity-flipping golf puzzle after Gravity Golfing, with its own physics and procedural Khokhloma-painted levels.

Live: [https://frozik.github.io/portfolio/space-golf](https://frozik.github.io/portfolio/space-golf) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/space-golf/`.

A golf puzzle in space, after the iOS game Gravity Golfing: whichever
horizontal or vertical wall the ball touches becomes the floor, 45° cuts
only bounce it, and the cup must be reached by chaining walls. Rendered
with WebGPU, physics written for the game (`features/space-golf/domain`).
Reset to the essentials on 2026-09-14 — the field and the ball — to get the
rendering and the feel right first; the cup and the spikes are back,
elastic bars, pickups and the solvability guarantee are on the way one at a
time.

- Press anywhere and pull the rubber band, at any time — while the ball
  still moves the five dots and the ring follow it in grey, and turn white
  the moment it rests and letting go plays the stroke; the dots run in a
  straight line from the ball and show the direction and the power of the
  impulse, not the flight — the bend under gravity is for the player to
  judge; returning to the anchor cancels the stroke, and so does letting
  go before the ball rests
- The pull is drawn where the hand is: a hazy blue sphere quivers where the
  press landed — the point the stroke is measured from, which nothing else
  shows — and three lines of energy arc from it to the finger, swaying and
  running with a travelling pulse, the whole picture brighter the further
  the band is stretched and full at the strongest stroke. It is measured on
  the screen, so it keeps its size at any zoom
- Gravity does not flip at the hit: the pull travels from where it was to
  the new floor in 0.3 s whatever the angle, so a reversal passes
  through weightlessness and a ball that touched a ceiling sags off it
  before it is drawn back up; the dust drifts along the very same pull, so
  the field shows the turn as it happens
- One bonus floats on the board, a breathing disc three balls across: the
  ball flies through it and takes it. A blue one with a little arc of dots
  gives foresight — the aim dots become the flight itself up to its first
  touch, played ahead by the same physics the ball then flies by — and each
  further one, up to five, adds three dots of range, shown in the HUD as
  five pips that light up one by one. A pink one with a splat of gum gives
  the grip: the next ten touches of an island's face that end a flight —
  flat or 45° — stick
  the ball right where it touches, ten more with every further disc, the
  count shown in the HUD; spikes still
  burst it, floaters and rods still bounce it. Both last until the ball
  bursts; past the fifth foresight every disc is a grip. The disc stays for
  one to three strokes and moves, or comes back after it was taken, only
  when the ball has come to rest, so a stroke can be planned for it
- The course is drawn at one scale, 64 pixels a metre, and a narrow screen
  starts zoomed out from it — a phone shows twelve metres across, not six —
  by a camera that stands still while
  the ball rests, is aimed and flies, and moves only once the flying ball
  is within a tenth of the screen from a side, and then exactly as fast as
  the ball; centring on the ball is the player's own — a double tap, `C` or
  the HUD button glides there, eased in and out — and the view's own only
  for a burst ball, which it glides to the middle of the screen where it
  comes back; two fingers, the
  wheel, the right button or the arrows look around, a pinch or Ctrl + wheel
  zooms out to an overview, and a
  compass points to the cup with the distance, a scale bar under it showing
  how long a metre is on the screen
- The physics runs in fixed steps and the ball is drawn between them, so
  it glides evenly at any refresh rate, trailing a short tapered streak
  along the path it really flew — a few-pixel ball would strobe without it
- The cup is a real rounded notch, two ball widths across, that the ball has to roll into —
  a fast ball bounces off its rim — and holing out adds the strokes to a
  running total kept with the level in IndexedDB
- Long, deep faces carry a stretch of elastic or viscous surface, drawn
  so the outcome is readable before the stroke: a taut shimmering gold
  membrane between two posts keeps the ball hopping, a dark dripping goo
  swallows the impact and holds it
- Spike rows of one to three white teeth, each a ball wide and two balls
  tall, stand on a few horizontal and vertical faces; every stroke flips
  every row — standing teeth sink into the face leaving a dark socket,
  sockets grow teeth — before
  the ball moves, except a sunk row the ball is lying on, which waits
  until the ball has left it; a standing tooth bursts the ball where it touches it,
  and the ball comes back to its last rest with the rows as the stroke left
  them, so the tooth that killed it is down for the next try
- Squares, diamonds and circles float in the open, three to ten where
  there is room, their centres ten ball diameters clear of every wall and
  of each other; each is small, one ball across, or large, two, and flips
  between the two with every stroke like the spikes do — unless the ball
  is lying on it or would be swallowed by its growth — and which way it
  flips is for the player to remember; its sides bounce the ball a touch
  more briskly than a wall and never turn gravity, though the ball may
  come to lie on top of one; painted after the Mezen tradition, red ochre
  and soot on dark wood — rows of zigzags, lozenges and slanted strokes on
  a square, a rim, a ring of rays and a sun on a circle
- Two to four rods slide out of wall faces to bridge the gap to the face
  squarely across, up to forty ball widths away, the pointed tip seating in
  a plate on the far face like the one it slides out of; a steel rod slides
  out at a steady pace while gravity points its way and back in otherwise,
  a thicker brass screw turns out along gravity, in against it and holds
  where it is while gravity runs across it, so every flip of the floor
  redraws the bridges; for the ball it is a wall as
  springy as a floater and just as indifferent to gravity, the ball may lie
  on it and is dropped when it slides away, and its pointed tip nudges a
  ball in its path aside — along a wall the ball lies against, never into
  it, and a ball with nowhere to go stops the rod until it is played away;
  a ball that has come to a stop against anything
  at all — wedged between a rod and a corner, say — is at rest and can be
  shot, though a burst ball comes back only to its last rest on the flat of
  an island's face with no spike row under it and no floater or rod
  touching it — ground that will still be there
- The course is endless. The plane is cut into sectors sized to the
  screen the world was made on. The country is made while the ball
  rests — two screens out in every direction, a sector a frame — and the
  stroke stops that work until the ball rests again, so a flight costs
  nothing but itself; only a flight that leaves what was made, or a camera
  looking past it, has a sector made on the fly. A sector is islands after the original's — blocks and bars grown
  into L, T, Z and stair shapes, lozenge and octagon islets, a metre thick,
  most corners cut by a long diagonal — that reach a little into the
  sectors next door and keep their gap from what already stands there, so
  no seam shows; then surfaces, spike rows, floaters and rods, every rod
  fastened at both ends to islands of its own sector. Holing out closes the cup under the
  ball, counts the hole, drops everything but the block of sectors round
  the ball — the country beyond is made anew, differently — and cuts the
  next cup one to three sectors away; there are no levels and no edge to
  fall off, only a terminal speed. The world, the ball and the counters are
  kept in IndexedDB, and a two-press button starts a new world