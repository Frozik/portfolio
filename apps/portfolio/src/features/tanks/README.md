# Tanks

A Battle City (NES, 1985) remake with mechanics traced from the ROM, all 35 stages, synthesized audio and no extracted assets.

Live: [https://frozik.github.io/portfolio/tanks](https://frozik.github.io/portfolio/tanks) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/tanks/`.

A faithful Battle City (NES, 1985) remake rendered with WebGPU — all 35
original stage layouts with gameplay rules traced from a disassembly of the
original ROM.

**Fidelity:**
- Exact original mechanics: 8-unit grid snap on turns, per-class tank
  speeds, quadrant-level brick destruction, the three power-up carriers per
  stage, weighted power-up odds, and the enemies' three-phase aggression
  curve (wander → hunt the player → converge on the base)
- Animation timings (track frames, spawn twinkle, explosions, shovel's
  flashing warning) match the original tick-for-tick
- Everything creative is original work: pixel art authored as code and
  rasterized into a single texture atlas at startup, sound effects and
  jingles synthesized with WebAudio — the repo contains no extracted assets
  and no binary files

**Engine:**
- Pure TypeScript domain (100% unit-tested, 400+ tests) driving a
  fixed-timestep 60 Hz simulation, decoupled from display refresh
- Instanced WebGPU rendering: terrain quadrants, sprites with palette
  variants, see-through forest canopy above the tanks, effects overlay
- Keyboard + touch controls, auto-pause on tab switch, best score persistence
- Touch: the play area is split in two — any press on the left half holds the
  gun, with the fire button riding the finger, and any press on the right half
  plants a floating joystick under the thumb.
  Inside the circle around the press the tank stands still; outside it the
  ground is split along the diagonals into four directions. The stick follows
  a thumb that outruns its reach, so reversing takes a short move back, and
  holds its direction while the thumb drifts just across a diagonal, so the
  tank does not flip between two headings. A captured finger may travel
  anywhere, but neither control follows it out of its own half of the screen.
  Both controls are drawn 144 px
  wide — wider than a thumb — and light up along their rims, so the feedback
  shows around the finger that covers their centre
