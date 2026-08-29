# Scorched — Feature Specification

A modern browser reimplementation of **Scorched Earth** (Wendell Hicken, DOS,
1991–1995) — the definitive 2D artillery duel: hot-seat tank battles over
destructible terrain, an absurdly deep weapons shop, wind, and falling dirt.
Rendered with **WebGPU**, with the terrain simulation (crater carving, smooth
falling-sand collapse, explosion particles) running in **compute shaders**.

This document is the complete implementation contract, written to the same
standard as `features/tanks/description.md`: gameplay rules and numbers come
from the original game's own manual (primary source), the architecture is
modern throughout, and everything creative — art, sound, taunt texts — is our
own work.

---

## 1. Sources, fidelity and IP policy

### 1.1 Authority order for gameplay facts

1. **[MANUAL]** — the official Scorched Earth 1.5 manual (SCORCH.DOC, written
   by the game's author). Read as reference; mechanics are restated in our own
   words, numeric tables are facts. Highest authority — nearly every constant
   below carries this tag.
2. **[DEV]** — the developer's own site/FAQ (whicken.com/scorch).
3. **[CLONE]** — open-source clones, primarily
   [Atomic Tanks](https://github.com/sourcecode-reloaded/atanks) (GPLv2).
   **Reference-only for implementation ideas** (e.g. its per-column dirt
   collapse confirms the genre-standard model); its numbers are its own, never
   the original's, and its GPL code is never copied (our repo is not GPL).
4. **[WIKI/FAN]** — Wikipedia and retrospectives; lowest authority. Two pieces
   of folklore are explicitly **rejected** by the research: the game's default
   resolution was 360×480 (320×200 was the compatibility floor, not the
   default), and "death explosion scales with the dead tank's arsenal" has no
   primary evidence — we do not implement it.

### 1.2 Modernization principle — rules from the manual, architecture from today

Same principle as tanks §1.3, proven there: **we take the numbers and the
feel, never the era's technique.** The original is DOS-era procedural code
over VGA framebuffers; ours is a pure TypeScript domain with exhaustive typed
unions, an event-driven world, injected randomness (lodash-es `random`,
mocked in tests), durations in ticks, GPU compute for everything massively
parallel, and full unit-test coverage. Where the manual documents a knob but
not the algorithm behind it (terrain generation), we choose a modern
algorithm and map the manual's knobs onto it, documenting the choice.

### 1.3 Artwork, sound and text policy

**Nothing is extracted from the original.** Tanks, terrain palettes, skies,
UI chrome — our own vector/pixel art in the *spirit* of the original.
Sound — synthesized in code via WebAudio exactly like tanks §12.3 (no audio
files). **Talking-tank taunts are our own writing**, in both English and
Russian, stored in the feature's translations — the original's taunt files
are the author's creative text and are not reproduced. Weapon names (Missile,
MIRV, Death's Head, Funky Bomb, Roller…) are short functional
identifiers of record — kept as-is for recognizability.

---

## 2. Player-facing scope and product stance

**Product stance (load-bearing): modern, beautiful, and deliberately
uncomplicated.** The original buried its brilliance under labyrinthine DOS
menus and ~50 toggles. We keep the brilliance — the arsenal, the wind, the
falling dirt, the AI personalities — and shed the bureaucracy: **curated
defaults + progressive disclosure**. A player must get from the landing card
to their first shot in under 30 seconds without reading anything.

- **v1**: local hot-seat for **2–10 players** (any mix of humans and the 8 AI
  personalities), sequential turns, rounds with the shop between them, the
  full weapons/accessories catalog of §6–§7, wind/gravity/walls physics,
  STANDARD scoring, keyboard aiming on desktop and **first-class virtual
  touch controls on mobile** (§12.2), synthesized sound, our-own-text talking
  tanks (off by default).
- **Option surface, curated**: the pre-match screen exposes exactly the
  choices that change the fun — roster (players + AI types), rounds, wind
  (off / steady / changing), walls preset (none / bouncy / wrap), starting
  cash. Everything else (gravity, viscosity, borders-extend,
  play order, talk probability, arms level…) lives behind one collapsed
  "Advanced" panel with the manual-faithful defaults of §5 — present for
  purists, invisible to everyone else.
- **Deliberately out of v1** (architecturally anticipated): Simultaneous and
  Synchronous turn modes, teams (Standard/Corporate/Vicious), Free Market
  price simulation, hostile-sky lightning, network play. Each is a §15 note,
  none blocks v1.

---

## 3. Feature layout (DDD)

```
apps/portfolio/src/features/scorched/
  description.md                    # this document
  domain/                           # pure TS. No React/MobX/RxJS/GPU. 100% unit-testable.
    constants.ts                    # every number from §5–§9, named, with [MANUAL] provenance
    types.ts                        # players, tanks, weapons, projectiles, events, options
    terrain/
      heightfield.ts (+ .test)      # column heightmap: query, carve, deposit, rest-state collapse
      terrain-generator.ts (+ .test)# midpoint-displacement generator behind the manual's knobs
    ballistics.ts (+ .test)         # projectile integration: gravity, wind, viscosity, walls
    weapons/
      catalog.ts                    # the §6 table as data (registry pattern)
      behaviors.ts (+ .test)        # per-family flight/impact behavior (exhaustive switch)
      explosions.ts (+ .test)       # blast application: damage falloff, carve/deposit shapes
    items.ts (+ .test)              # shields, batteries, guidance, triggers, fuel
    economy.ts (+ .test)            # cash, interest, bundles, 99-cap markup, sell-back
    ai/
      personalities.ts (+ .test)    # the 8 strategies as pure decision functions
      aim-solver.ts (+ .test)       # closed-form + iterative ballistic solving (wind-aware)
    scoring.ts (+ .test)            # BASIC/STANDARD(/GREEDY later) round scoring
    round.ts (+ .test)              # turn state machine for one round
    match.ts (+ .test)              # rounds sequence, banking, shop phase, final standings
  application/
    ScorchedStore.ts (+ .test)      # MobX: data and data methods only (tanks §12 lesson)
    ScorchedAudioController.ts (+ .test) # audio side-effects reacting to store data
    useScorchedStore.ts
    render/
      scorched-draw.ts              # runScorched(options): VoidFunction (sync wrapper)
  infrastructure/
    audio/                          # synth, recipes, jingles — same shape as tanks
    terrain-texture.ts              # CPU heightfield → GPU terrain texture mirror
    compute/
      dirt-collapse.wgsl            # per-column falling-dirt animation pass
      carve.wgsl                    # crater/deposit stamping into the terrain texture
      particles.wgsl                # explosion debris / smoke / napalm particle update
    layers/
      sky-layer.ts                  # gradient/stars/sunset backdrops
      terrain-layer.ts              # fullscreen quad sampling the terrain texture
      tank-layer.ts                 # instanced tank sprites + turret lines
      projectile-layer.ts           # shells, trails, laser beam
      particle-layer.ts             # renders the compute-simulated particles
    shaders/                        # render WGSL (common uniforms + quads)
    key-aim-source.ts               # held-key aiming (±1, fine, coarse)
    touch-aim-source.ts             # touch aiming per §12
  presentation/
    Scorched.tsx
    components/                     # game shell, HUD bar, shop screen, overlays, touch controls
    translations/ en.ts  ru.ts  index.ts   # includes our own taunt lines
```

Import direction: `presentation → application → domain ← infrastructure`.
Store = data only; renderer and audio controller are owned by the game shell
component (both lessons inherited from tanks).

**Code style**: no bitwise operations, no `any`/`!`, no barrels, lodash-es
`random` directly with `vi.mock` pinning in tests — all the repo/tanks rules
apply verbatim.

---

## 4. Units, field and coordinates

- **World units (wu)**: the battlefield is a logical **800 × 500 wu** field
  (one wu = one terrain column = one logical pixel; chosen for widescreen
  fit, not copied from the original whose logical size followed the video
  mode). All physics constants are calibrated to this field and the manual's
  values are mapped onto it at M4 against gameplay footage feel.
- Origin bottom-left for terrain height semantics (`height[x]` = ground
  height in wu); projectile space uses the same axes (+x right, +y up).
- **Time**: fixed 60 Hz simulation ticks during projectile flight and dirt
  settling; aiming/shop phases are event-driven (no ticking). Render loop
  runs at display rate, driving the accumulator exactly like tanks §5.
- The domain is deterministic given inputs + mocked randomness; the world
  emits typed events (`projectile-launched`, `terrain-carved`,
  `dirt-settled`, `tank-damaged`, `tank-destroyed`, `round-ended`, …) that
  drive rendering, audio and HUD — never polled state.

---

## 5. Ballistics and physics (manual-sourced)

| Rule | Value | Source |
|---|---|---|
| Angle | 0–90° per facing side (turret flips left/right; UI may present 0–180 but the model is side+elevation) | [MANUAL] |
| Power | 0…(health × 10); full-health max **1000**. **Damage directly caps firepower** — a tank at 40 health fires at most 400. This coupling is load-bearing; reproduce exactly | [MANUAL] |
| Health ("power") | 0–100 per tank; 0 = destroyed | [MANUAL] |
| Gravity | default **0.2** (manual range 0.05–10) in original units; calibrate the wu/tick² equivalent at M4 so a max-power 45° shot spans ≈ the same fraction of the field as in reference footage | [MANUAL] + calibration |
| Wind | single global vector per round; magnitude 0–500, default max **200**; horizontal acceleration on projectiles. `Changing Wind` option (default off): re-roll drift after every shot | [MANUAL] |
| Air viscosity | 0–20, default **0**; velocity damping in flight. Breaks Ballistic Guidance and Spoiler-AI compensation when on — reproduce that interaction | [MANUAL] |
| Walls | NONE (default) / CONCRETE (absorb) / PADDED (bounce, energy loss) / RUBBER (bounce, full energy) / SPRING (bounce, energy gain) / WRAP (left↔right) / RANDOM (per round) / ERRATIC (per shot). The top boundary follows the same mode; the field floor is bedrock in every mode — a shell detonates on it and never burrows into it | [MANUAL] |
| Borders extend | shots leaving the field stay tracked for a margin (default 75 original units → scaled) before being scored a miss | [MANUAL] |
| Tunneling | projectiles burrow into dirt before detonating (default on); a **Contact Trigger** item forces surface detonation for that shot, covering all sub-warheads of the shot | [MANUAL] |
| Tank falls | terrain removed under a tank → it rides the settling sand down (toggleable); the descent is gentle and free — no fall damage, so no parachutes either | our design |
| Knockback | none — explosions never shove tanks sideways; tanks move only by fuel, falling, or sliding down steep slopes | [MANUAL] (documented absence) |
| Projectile speed | initial speed ∝ power; exact scale factor is our calibration constant (§15) | design |

---

## 6. Weapons catalog

The §6 table is data (`domain/weapons/catalog.ts`), one record per weapon:
cost, bundle size, blast radius (original units, scaled), arms level (0–4
shop-tier gate, default all available). Values are [MANUAL] facts:

| Weapon | Cost | Bundle | Radius | Lvl | Behavior family |
|---|---|---|---|---|---|
| Baby Missile | 400 | 10 | 10 | 0 | ballistic (free infinite baseline) |
| Missile | 1 875 | 5 | 20 | 0 | ballistic |
| Baby Nuke | 10 000 | 3 | 40 | 0 | ballistic |
| Nuke | 12 000 | 1 | 75 | 1 | ballistic |
| Leap Frog | 10 000 | 2 | 20/25/30 | 3 | 3 sequential hops, each detonating further along |
| Funky Bomb | 7 000 | 2 | 80 | 4 | impact + scatter of random secondary bursts (self-risk) |
| MIRV | 10 000 | 3 | 20×5 | 2 | splits into 5 warheads **at apex**; no split if it impacts first |
| Death's Head | 20 000 | 1 | 35×9 | 4 | MIRV with 9 baby-nuke-class warheads |
| Napalm | 10 000 | 10 | flow | 2 | liquid fire: spreads both ways from the impact along the surface, downhill first; burns whoever it covers once, chars the ground and blazes out in ~2 s |
| Hot Napalm | 20 000 | 2 | flow | 4 | stronger napalm — over twice the spread |
| Baby Roller | 5 000 | 10 | 10 | 2 | our design: crawls the surface in its flight direction — hills included — detonating on the first tank or just short of a shielded one; a too-steep wall sets it off |
| Roller | 6 000 | 5 | 20 | 2 | roller |
| Heavy Roller | 6 750 | 2 | 45 | 3 | roller |
| Riot Charge | 2 000 | 10 | 36 | 2 | self-centered wedge dirt removal (dig yourself out) |
| Riot Blast | 5 000 | 5 | 60 | 3 | wider riot charge |
| Riot Bomb | 5 000 | 5 | 30 | 3 | projectile dirt-pocket carve, no tank damage |
| Heavy Riot Bomb | 4 750 | 2 | 45 | 3 | bigger riot bomb |
| Dirt Clod | 5 000 | 10 | 20 | 0 | deposits a dirt sphere on impact |
| Dirt Ball | 5 000 | 5 | 35 | 0 | bigger deposit |
| Ton of Dirt | 6 750 | 2 | 70 | 1 | buries a tank whole |
| Liquid Dirt | 5 000 | 10 | — | 2 | streams into hollows portion by portion, then freezes solid |
| Dirt Charge | 5 000 | 5 | — | 1 | self-centered Riot Charge in reverse: piles a dirt wedge over the firing tank |
| Plasma Blast | 9 000 | 5 | 25–75 | 3 | fired from the tank itself with a cyan-violet nova; consumes N batteries, radius scales with N |
| Laser | 5 000 | 5 | — | 2 | instant straight beam through terrain **and shields** |

Blast application (`explosions.ts`): circular carve of the heightfield +
radial damage with falloff from the center (exact falloff curve is not in
the manual — linear-to-zero at radius is the v1 default, §15). Guidance
incompatibility list (MIRV, Death's Head, Riot Charge/Blast, Plasma) is
enforced in the model [MANUAL].

## 7. Accessories

[MANUAL] table as data: Heat/Ballistic/Horizontal/Vertical Guidance and Lazy
Boy are **permanent devices** (our deviation from the manual's bundles: one
purchase installs the device for the whole match, the per-shot selection
still resets after every shot; Ballistic corrects wind but not viscosity),
Batteries (+10 health each, cap 100; double as
Plasma ammo), Mag Deflector (upward push on passing shots, saturable),
Shield / Force Shield / Heavy Shield (absorption tiers, drawn as a ring
around the tank — thickness by tier, opacity fading with remaining energy;
direct hits damage the shield instead of detonating; force tier also
deflects; own shots pass
out through your own shield but its protection still applies to indirect
damage — including your own descending shot, the manual's famous suicide
warning, reproduce it), Super Mag (heavy shield + laser immunity + mag
push), Auto Defense (pre-round arming plus an instant replacement whenever
the standing bubble collapses; price scales with rounds left), Fuel
(1 unit = 1 wu horizontal move, more uphill; sliding on too-steep slopes),
Contact Triggers ($1 000 × 25). Prices/bundles per the researched table in
`catalog.ts`.

## 8. Economy and rounds

- Cash starts at **$0** (configurable), banks between rounds at **5%
  interest** (0–30 configurable) [MANUAL].
- Shop between rounds for survivors: fixed bundles; **99-per-item cap** with
  ≈20% markup on a truncated final bundle; sell-back at computer-quoted
  prices [MANUAL]. Free Market simulation is out of v1 (§2). A match with
  starting cash opens on the shop, so the money is spent before the first
  shot.
- Scoring **STANDARD** (v1): kill points + continuous damage points,
  self/team damage penalized; BASIC and GREEDY are §15 follow-ups. Retreat
  (helicopter out) forfeits points but denies the killer bounty [MANUAL].
- Match = N rounds (default 10, 1–1000); most kills across rounds wins
  overall (aggregate rule is [WIKI]-tier — verify at M4).

## 9. AI personalities

Eight named strategies, [MANUAL]-documented, implemented as pure decision
functions over the same aim-solver toolkit:

| Name | Strategy |
|---|---|
| Moron | random angle/power every shot |
| Shooter | solves aim only with a clear line of fire |
| Poolshark | Shooter + bank shots off RUBBER/SPRING walls and ceiling when active |
| Tosser | starts random, iteratively refines toward the target shot-over-shot |
| Chooser | picks whichever of the above fits the situation |
| Spoiler | near-perfect wind+gravity compensation; cannot compensate viscosity |
| Cyborg | Spoiler aim + vindictive targeting (weakest / leading / whoever hit it) |
| Unknown | secretly one of the above, undisclosed |

`aim-solver.ts` provides: closed-form no-drag solution, wind-corrected
iteration, wall-bounce path search (for Poolshark), and a refinement step
(for Tosser). All deterministic under mocked randomness; personality tests
pin behaviors (e.g. Spoiler accuracy degrades exactly when viscosity > 0).

`shopping.ts` (our own rule — the manual never documents AI spending):
between rounds a surviving AI shops defence first — the best bubble its
budget stands, Auto Defense while enough rounds remain and a battery —
then spends the rest of its budget on the heaviest weapons
affordable. Plans are advisory; the match re-quotes and refuses what no
longer fits.

---

## 10. Terrain: heightfield, carving, falling dirt

- **Model**: a per-column heightfield (800 columns, height in wu); gravity
  is absolute, so no voids or overhangs ever survive a carve — dirt above a
  blast drops instantly. Authoritative terrain lives **on
  the CPU in the domain** — deterministic, unit-testable, queried by
  ballistics/AI — and is mirrored into a GPU texture for rendering and
  cosmetic animation (§11). This split is the project's core architectural
  decision: *the domain resolves terrain instantly; the GPU animates the
  transition*.
- **Generation** (`terrain-generator.ts`): midpoint displacement with
  configurable roughness octaves — a modern, documented choice (the
  original's algorithm is undocumented; the manual only exposes knobs). The
  manual's knobs map on top: `Bumpiness` → displacement amplitude, `Slope` →
  low-frequency tilt/spread, `Flatten Peaks` → slope clamp. Seeded via
  injected randomness for testability.
- **Carving/deposit**: explosions subtract (or add, for dirt weapons)
  circular/wedge shapes.
- **Falling dirt**: after any carve, unsupported dirt collapses
  **vertically per column** to its rest position (the genre-standard model;
  confirmed by clone source and consistent with the manual's fall-damage
  description). The **domain computes final rest heights
  immediately** (pure function, tested); the **GPU animates the descent**
  smoothly (§11) — gravity-accelerated columns, exactly the user-visible
  "плавное падение песка". Tanks standing on collapsing columns ride down
  with them, gently and free of damage. The round waits the settling out: the
  turn stays in flight for the deepest drop's fall time (same gravity
  constant as the animation), so nobody fires over ground still coming down.

---

## 11. WebGPU rendering & compute

Built on the shared kernel (`@frozik/utils/webgpu/*`: `createGpuContext`,
`RenderLayer`, `RenderLayerManager`, `startRenderLoop`) exactly like tanks
§11 — sync-wrapper init, reverse-order teardown, component-owned renderer.

### 11.1 Terrain on the GPU

- The terrain is an **rgba8 texture** (800×500 texels = 1 texel per wu):
  channel 0 = dirt presence, channels 1–2 = palette variation / scorch
  darkening near blast edges. Rendered by a fullscreen quad sampling the
  texture over the sky layer, nearest-sampled, fractional upscale (this is
  not tile art — integer scaling is not required).
- **Carve compute pass** (`carve.wgsl`): explosion events enqueue stamp
  operations (circle/wedge, signed: remove or deposit);
  one dispatch stamps them into the texture. Scorch darkening is applied in
  a ring around removals.
- **Dirt-collapse compute pass** (`dirt-collapse.wgsl`): one thread per
  column animates falling spans toward the domain-computed rest heights
  with per-column velocity (gravity-accelerated), writing the intermediate
  texture each frame until every column matches its target — the smooth
  falling-sand animation, entirely on GPU, zero per-frame CPU work. The
  domain's rest state is the single source of truth; the animation is
  cosmetic and cannot desync gameplay (collisions during collapse use the
  domain state).
- Ping-pong between two terrain textures for the compute passes; the render
  pass samples whichever is current.

### 11.2 Explosion physics on the GPU

- **Particles** (`particles.wgsl` + `particle-layer`): debris, smoke puffs,
  napalm droplets and dirt spray live in a GPU storage buffer; a compute
  pass integrates velocity/gravity/lifetime per particle (thousands of
  particles at trivial cost), the render pass draws them instanced. Spawn
  parameters arrive per explosion event. Purely cosmetic — gameplay damage
  is domain-side (§6).
- **Napalm flow**: the domain computes a surface-hugging burning run (both
  fronts advance from the impact, the lower one first) — flame particles sit
  on the per-column surface heights and scorch stamps char the dirt under
  them; a full compute-fluid napalm is a §15 stretch goal.
- Projectiles, trails (Trace Paths option) and the laser beam render in
  `projectile-layer` from domain positions. The manual's Tracers are cut
  by design: the wind-aware aiming ghost (§12.2) already shows the path.

### 11.3 Sky and look

Sky presets as our own gradients/starfields (plain, stars, shaded, sunset,
cavern, black; random default). Tanks come from a cartoon blueprint
generator: an outlined chassis with an overhanging sloped hull and a tracked
run of road wheels, a turret (angular with a cupola / box / rounded) that
turns with the aim, and a gun that tilts against the turret — every player
rolls their own machine for the session. Shells spawn at the gun's muzzle
(`getLaunchOrigin`), and the AI solvers aim with the same geometry. Player
color-coding for names, tanks and
trails [MANUAL-structural]. HUD is React/Tailwind (§13): top bar with
power/angle/player/weapon, wind indicator in the sky corner — structure
follows the original, styling is ours. No MSAA needed; the terrain texture
is the aesthetic.

---

## 12. Application layer, input, audio

- **`ScorchedStore`** — data only (tanks §12 lesson applied from day one):
  match/round/turn state, per-player data (cash, health, inventory,
  selections), aim values, options, shop state, taunt line picks. Renderer
  and audio controller are owned by the shell component; per-tick/turn
  events flow from the draw orchestrator's host callback.
- **Input — desktop**: keyboard per the original's spirit (arrows ±1, Shift
  fine, PageUp/Down coarse for power; Tab/keys for weapon cycling; Space to
  fire), plus direct mouse drag-to-aim identical to the touch gesture below.

### 12.2 Virtual controls (mobile) — first-class, not a port

Visible when `(pointer: coarse)` matches (matchMedia gate, safe-area insets,
pointer capture — all the conventions proven in tanks §12.2):

- **Drag-to-aim**: touch anywhere on the field and drag — a vector from the
  active tank sets angle and power together, with a **live dotted trajectory
  ghost** (first ~1.5 s of simulated flight under current wind; the ghost is
  an aid, not an oracle — it fades with distance so long shots still take
  skill). Release does NOT fire — aiming and firing are separate acts, so a
  slip never wastes a turn.
- **Fine-tune pads**: two compact semi-transparent steppers (angle left /
  power right, bottom corners) with press-and-hold repeat for ±1 precision
  after a coarse drag; the same visual language as the tanks D-pad (white 8%
  idle, 25% active, ~80 ms transitions, monochrome glyphs).
- **Fire** — a single prominent button, bottom-center, with the selected
  weapon's icon and remaining count on it; disabled state while a shot is in
  flight.
- **Weapon carousel**: horizontal swipe strip above the fire button (opened
  by tapping the fire button's weapon badge) — large touch targets, one row,
  grouped by family, owned-count badges; closes on selection.
- **Hot-seat handover**: between turns a full-screen "pass the device" card
  with the next player's name and color (skippable instantly for
  all-AI-versus-one play); prevents accidental input from the previous
  player and doubles as the pacing beat.
- **Audio** (`ScorchedAudioController` + `infrastructure/audio/`): the tanks
  §12.3 synthesis stack reused as a pattern (engine hum is replaced by
  wind ambience; recipes for shot, whistle-fall, explosion sizes, napalm
  crackle, dirt rumble, shield hit, shop cash register, round jingles —
  original compositions/PD only). Mute persisted; gesture unlock; suspend
  on hidden.
- Auto-pause semantics: hot-seat game pauses only projectile/collapse
  animation on tab hide (aiming/shop phases have nothing to pause).

---

## 13. Presentation and design language

**Design language (load-bearing, per the product stance of §2):** the game
must look and feel like a polished modern product that *evokes* the classic,
not a DOS museum piece. Concretely:

- **Visual base**: the portfolio's existing Tailwind/Radix design system —
  dark surfaces, glass panels (`backdrop-blur`, translucent whites), the
  shared `Button`/`Slider`/`Dropdown`/`Tooltip` primitives, smooth 150–250 ms
  transitions on every state change. The battlefield itself carries the
  retro soul (jagged silhouette terrain, gradient skies, chunky pixels); the
  chrome around it is unapologetically 2026.
- **Menus, reworked**: one pre-match screen — a roster builder with player
  cards (name, color swatch, human/AI-personality picker with a one-line
  strategy description per AI), the §2 curated options row, and a single
  prominent Start. No nested menu trees. Advanced options collapse into one
  panel with search-free, grouped, tooltip-documented controls.
- **Shop, reworked**: the between-rounds screen is the emotional core of the
  original and gets the most design attention — weapon cards grouped by
  family with our own iconography, price/bundle/owned badges, a one-line
  behavior description (our words), affordable/unaffordable states, a cart
  summary with bank/interest preview, and a sell-back drawer. Readable in
  ten seconds, delightful to browse; no data tables.
- **In-game HUD**: minimal top strip (player name+color, health/power bar,
  angle·power readout, wind arrow, weapon badge) — everything else appears
  contextually (damage numbers float and fade at impact points; every tank
  carries an outlined tank-wide health bar under its hull that blends
  green→orange→red as health drains).
- **Content quality bar**: every AI personality, weapon and item gets a
  short flavorful description (en/ru, our own writing); round/match result
  screens celebrate (biggest hit of the round, most damage dealt); empty
  states and edge screens (everyone dead simultaneously, bankrupt shop
  visit) are designed, not default text.
- **Feel**: subtle screen shake scaled to blast size (with a reduced-motion
  opt-out respecting `prefers-reduced-motion`), hit-stop of a few frames on
  direct hits, eased camera — the juice that makes a turn feel consequential
  without cluttering the simulation.

Structure: `Scorched.tsx` → `WebGpuGuard` → game shell: canvas + HUD strip +
overlays (pre-match roster, pass-device card, shop, round results, match
results) + virtual controls (§12.2). Shop and menus are pure React screens —
no GPU involvement.
- Registration checklist identical to tanks §13: `ROUTE_METADATA` entry
  (`segment: 'scorched'`, lucide icon — e.g. `Mountain` or `Target`),
  `pageTitles.scorched` in both app translation files, lazy route, feature
  translations with `resolveTranslation` (`scorchedT`), landing-page project
  card (fx: an artillery arc over jagged terrain silhouette — same accent
  system as the other cards), root `README.md` + `IDEA.md` on ship.

---

## 14. Testing plan

- **Domain (bulk)**: ballistics integration incl. wind/viscosity/wall modes
  (each wall mode's reflection/absorption/wrap pinned); power cap = health×10
  coupling; every weapon family's impact behavior (MIRV apex split vs
  early-impact no-split; roller crawl pathing; funky scatter under mocked random;
  napalm pooling spans; dirt deposit shapes; laser line); items (battery cap, shield absorption/deflection incl. the
  own-descending-shot suicide case, contact trigger multi-warhead coverage);
  economy (interest, bundles, 99-cap markup, sell-back); terrain generator
  (knob monotonicity, seeded determinism); heightfield carve/collapse rest
  state (mass conservation where applicable, no floating spans); AI
  personalities (per-strategy behaviors pinned, Spoiler-vs-viscosity
  degradation); round/match state machines; scoring.
- **Application**: store flow, audio controller reactions (stub engine).
- **Not unit-tested**: layers, WGSL compute (all logic that matters lives in
  the domain rest-state functions, which are tested).
- Gate: `pnpm check-all`; on-device visual pass for the collapse animation
  smoothness, particle feel and HUD.

---

## 15. Open questions (defaults specified, resolve at M4)

1. **Blast damage falloff curve** inside the radius — not documented;
   default: linear to zero at radius edge.
2. **Power → initial speed scale** and gravity calibration for the 800×500
   field — tune against reference footage.
3. **Leap Frog hop geometry** (spacing/direction of the 3 hops) — default:
   continue along the impact trajectory with damped energy.
4. **Funky Bomb scatter** count/spread — default: 6–10 bursts, field-wide
   uniform under mocked random.
5. **Napalm flow/pool parameters** and burn duration; full fluid sim on GPU
   is a stretch goal.
6. **Mag deflector force model** (strength/saturation) — default: constant
   upward acceleration within a radius, capacity budget per round.
7. **Aggregate match-winner rule** ([WIKI]-tier) — verify.
8. Out-of-v1 backlog: Simultaneous/Synchronous modes, teams, Free Market,
   hostile skies, GREEDY/BASIC scoring, meteor/lightning hazards.

---

## 16. Implementation milestones

1. **M1 — Domain core**: constants, types, heightfield + generator,
   ballistics, weapons catalog + behaviors + explosions, items, economy,
   AI, round/match machines, scoring — all tests green, no rendering.
2. **M2 — Render bring-up**: GPU context, sky/terrain/tank/projectile
   layers, carve + collapse compute passes (the falling-sand animation),
   aiming with keyboard, a playable 2-human duel on generated terrain.
   Route/nav/translations registration.
3. **M3 — Full game & design language**: pre-match roster screen and the
   redesigned shop (§13 — the design centerpiece), rounds/match flow, all 8
   AIs playable, items wired (shields/batteries/guidance),
   particles compute, virtual touch controls with the trajectory ghost
   (§12.2), pass-device handover, HUD, taunts (our texts, en/ru), overlays —
   verified on a real phone.
4. **M4 — Fidelity, sound & juice**: §15 calibration against footage, audio
   synthesis, wall modes polish, screen shake/hit-stop with reduced-motion
   opt-out, result-screen celebrations, advanced-options panel, landing
   card.
5. **M5 — Ship**: `check-all`, review pass, on-device verification,
   README/IDEA updates, deploy.

Estimated split: domain ≈ 45% (this game is rules-heavy), GPU ≈ 25%, UI ≈
20%, tuning ≈ 10%. Expected shared-lib touchpoints: none beyond what tanks
already extracted (`Vector2` in `@frozik/utils/math/vector2` is reused from
day one).
