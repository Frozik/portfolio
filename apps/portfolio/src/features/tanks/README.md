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
- Keyboard + touch controls (diagonal-split D-pad with slide-between-zones
  steering), auto-pause on tab switch, best score persistence
