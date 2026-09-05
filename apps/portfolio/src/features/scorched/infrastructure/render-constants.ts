import { MAX_PLAYER_COUNT, TICKS_PER_SECOND } from '../domain/constants';
import type { ShieldTier } from '../domain/types';

/** One texel per world unit, so the terrain texture mirrors the field exactly. */
export const TERRAIN_TEXTURE_FORMAT: GPUTextureFormat = 'rgba8unorm';

export const SUPPORTED_TEXEL_ALPHA = 255;

export const CHANNELS_PER_TEXEL = 4;
export const MAX_CHANNEL_VALUE = 255;

/** Palette variation is drawn once into a small tile and repeated, so a sync stays cheap. */
export const PALETTE_NOISE_TILE_SIZE = 64;

/** Two triangles covering the field, drawn without a vertex buffer. */
export const FIELD_QUAD_VERTEX_COUNT = 6;

export const CARVE_WORKGROUP_SIZE = 8;
export const COLLAPSE_WORKGROUP_SIZE = 64;

/** `CarveOp` in `carve.wgsl`: two `vec2<f32>` endpoints plus radius, kind and padding. */
export const FLOATS_PER_CARVE_OP = 4;
/** A funky bomb scatters ten bursts at once; the queue keeps whatever does not fit for later. */
export const MAX_CARVE_OPS_PER_DISPATCH = 32;

/** How far the burn mark reaches past the edge of a removal. */
export const SCORCH_RING_WU = 7;

/** A slow display must not replay a long stall as one huge jump of dirt. */
export const MAX_COLLAPSE_STEPS_PER_FRAME = 4;
export const COLLAPSE_SECONDS_PER_STEP = 1 / TICKS_PER_SECOND;

/** Health strip under the hull: tank-wide fill inside a dark outline that doubles as the track. */
export const HEALTH_BAR_HEIGHT_WU = 2;
export const HEALTH_BAR_OUTLINE_WU = 0.6;
export const HEALTH_BAR_GAP_WU = 1.5;
/** Shield ring: opacity tracks the remaining energy, thickness the tier's soak capacity. */
export const SHIELD_RING_RADIUS_WU = 12;
export const SHIELD_RING_THICKNESS_BY_TIER_WU: Readonly<Record<ShieldTier, number>> = {
  shield: 1,
  force: 1.8,
  heavy: 2.6,
};
/** Worst-case blueprint shapes (outlines, wheels, details) plus the health bar and shield ring. */
export const SHAPES_PER_TANK = 56;
export const MAX_TANK_SHAPE_INSTANCES = MAX_PLAYER_COUNT * SHAPES_PER_TANK;

/** The shell is a small capsule flying nose-first along its velocity. */
export const SHELL_HALF_LENGTH_WU = 2.6;
export const SHELL_RADIUS_WU = 1.2;
/** Trail samples are laid out by distance flown, so the ribbon stays even whatever the speed. */
export const TRACE_DOT_SPACING_WU = 6;
/** Samples kept per shell for its contrail. */
export const TRACE_PATH_LENGTH = 64;
/** A jump longer than any real per-tick step is a wall wrap — the trail must not bridge it. */
export const TRACE_TELEPORT_DISTANCE_WU = 40;
/** The contrail starts as a thin bright streak and disperses into a wide faint one. */
export const CONTRAIL_YOUNG_HALF_WIDTH_WU = 0.7;
export const CONTRAIL_OLD_HALF_WIDTH_WU = 2.4;
/** A Death's Head splits into nine warheads; nothing in the catalog puts more shells in the air. */
const MAX_SHELLS_IN_FLIGHT = 12;
/** Every shell draws its contrail segments plus its own capsule shapes. */
export const MAX_PROJECTILE_SHAPE_INSTANCES = MAX_SHELLS_IN_FLIGHT * (TRACE_PATH_LENGTH + 6);

/** The aim ghost's dots, plus the laser beams still glowing on the field. */
export const GHOST_DOT_RADIUS_WU = 1.6;
const MAX_GHOST_SHAPE_INSTANCES = 64;
export const LASER_BEAM_FADE_SECONDS = 0.45;
export const MAX_LASER_BEAMS = MAX_PLAYER_COUNT;

/**
 * Screen shake. The amplitude is deliberately tiny — a nuke moves the field by six
 * world units out of eight hundred, under one percent of the width — because the shake is meant to
 * register in the gut rather than in the eye, and because anything larger would drag the letterbox
 * edge into view. It is scaled by blast radius so a baby missile taps and a Death's Head slams.
 */
export const SHAKE_AMPLITUDE_PER_RADIUS_WU = 0.09;
export const MAX_SHAKE_AMPLITUDE_WU = 6;
export const SHAKE_DURATION_SECONDS = 0.34;
/** Fast enough to read as an impact rather than a wobble, slow enough to survive 60 Hz sampling. */
export const SHAKE_FREQUENCY_HZ = 21;
/** The vertical throw is smaller: ground shock reads as a sideways jolt, not a bounce. */
export const SHAKE_VERTICAL_FRACTION = 0.6;
/** Two blasts at once must not cancel, so each impulse is phased by where it went off. */
export const SHAKE_PHASE_PER_WU = 0.37;
/** Beyond this the oldest impulses are dropped; a funky bomb scatters ten bursts in one tick. */
export const MAX_SHAKE_IMPULSES = 6;

/**
 * Hit-stop: the world freezes for a few frames when a shell strikes a tank squarely,
 * which is what makes a direct hit feel like a hit rather than like another explosion. Only the
 * fixed-timestep simulation stops — rendering, particles and the shake keep running.
 */
export const HIT_STOP_SECONDS = 5 / TICKS_PER_SECOND;

/** The retreat helicopter: a simple shape rising off the field and fading as it climbs. */
export const RETREAT_FLIGHT_SECONDS = 1.6;
export const RETREAT_CLIMB_WU = 220;
export const RETREAT_BODY_HALF_WIDTH_WU = 7;
export const RETREAT_BODY_HALF_HEIGHT_WU = 4;
export const RETREAT_ROTOR_HALF_WIDTH_WU = 15;
export const RETREAT_ROTOR_HALF_HEIGHT_WU = 0.9;
export const RETREAT_ROTOR_OFFSET_WU = 6;
/** The rotor is drawn as a bar whose width oscillates — the cheapest possible spin. */
export const RETREAT_ROTOR_SPIN_HZ = 9;
/** Body, rotor and mast per departing tank; every tank may retreat once. */
const SHAPES_PER_RETREAT_FLIGHT = 3;
export const MAX_RETREAT_FLIGHTS = MAX_PLAYER_COUNT;

/** Everything the overlay layer may draw at once: the aim ghost, the beams and the helicopters. */
export const MAX_OVERLAY_SHAPE_INSTANCES =
  MAX_GHOST_SHAPE_INSTANCES + MAX_LASER_BEAMS + MAX_RETREAT_FLIGHTS * SHAPES_PER_RETREAT_FLIGHT;

/**
 * The particle pool. `Particle` in `particles.wgsl` is three `vec4<f32>`: position and
 * velocity, then age/lifespan/size/kind, then colour. Spawns overwrite the pool as a ring — the
 * oldest particle is always the one a new burst is allowed to take.
 */
export const FLOATS_PER_PARTICLE = 12;
export const PARTICLE_BYTES = FLOATS_PER_PARTICLE * Float32Array.BYTES_PER_ELEMENT;
export const MAX_PARTICLES = 3072;
export const PARTICLE_WORKGROUP_SIZE = 64;
/** Cosmetic gravity for debris, in wu per tick²; smoke and flame rise against it instead. */
export const PARTICLE_GRAVITY_WU_PER_TICK_SQUARED = 0.09;
export const PARTICLE_VERTEX_COUNT = 6;
