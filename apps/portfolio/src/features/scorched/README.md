# Ashfall

Scorched Earth reimagined: hot-seat artillery for 2–10 players over terrain simulated in WebGPU compute shaders.

Live: [https://frozik.github.io/portfolio/scorched](https://frozik.github.io/portfolio/scorched) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/scorched/`.

A modern reimplementation of the classic DOS artillery duel Scorched Earth
(1991) — hot-seat battles for 2–10 players over destructible terrain, with
the terrain simulation running in WebGPU compute shaders.

**Gameplay:**
- The original arsenal (24 weapons: missiles, nukes, MIRVs, rollers,
  napalm, dirt bombs, lasers…) and accessory catalog (shields,
  batteries, guidance systems) with manual-sourced prices and
  behaviors
- Eight AI personalities from the original manual — from the random-firing
  Moron to the wind-compensating Cyborg with vindictive targeting
- Rounds economy: banked cash with interest, a redesigned armoury screen
  with family-grouped weapon cards, sell-back, and honest bundle-cap markup
- Damage caps firepower (health × 10) — the original's signature coupling

**Engine:**
- Terrain lives as a per-column heightfield in the pure domain; the GPU
  mirrors it into a texture, stamps craters in a compute pass, and animates
  the falling-sand collapse column-by-column — provably convergent to the
  domain's instantly-computed rest state
- Explosion debris, smoke, and napalm flames are GPU-simulated particles
- Drag-to-aim (mouse or touch) with a live wind-aware trajectory ghost;
  screen shake and hit-stop honoring `prefers-reduced-motion`
- All audio synthesized in code; the talking-tank taunts are our own
  writing in both languages
