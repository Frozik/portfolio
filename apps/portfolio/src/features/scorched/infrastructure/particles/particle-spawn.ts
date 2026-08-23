import { random } from 'lodash-es';

import { TICKS_PER_SECOND } from '../../domain/constants';
import type { NapalmPool, WorldEvent } from '../../domain/types';

/** Matches the `kind` the particle compute pass switches its integration on. */
export const PARTICLE_KIND = {
  debris: 0,
  smoke: 1,
  flame: 2,
} as const;

export type ParticleKind = (typeof PARTICLE_KIND)[keyof typeof PARTICLE_KIND];

export interface ParticleInstance {
  readonly x: number;
  readonly y: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly lifespanTicks: number;
  readonly sizeWu: number;
  readonly kind: ParticleKind;
  readonly red: number;
  readonly green: number;
  readonly blue: number;
  readonly alpha: number;
}

const IS_FLOATING = true;

/** Sizing rules — cosmetic only, so they are tuned by eye and capped so a nuke cannot flood. */
const DEBRIS_PER_RADIUS_WU = 1.1;
const SMOKE_PER_RADIUS_WU = 0.5;
const MAX_PARTICLES_PER_BURST = 90;
const FLAME_COLUMN_STRIDE = 6;
const BURNING_WAVE_STRIDE_COLUMNS = 12;
const MAX_FLAMES_PER_POOL = 40;

const DEBRIS_SPEED_PER_RADIUS_WU = 0.05;
const SMOKE_RISE_WU_PER_TICK = 0.28;
const SMOKE_DRIFT_WU_PER_TICK = 0.2;
const FLAME_RISE_WU_PER_TICK = 0.35;

const DEBRIS_LIFE_TICKS = 0.9 * TICKS_PER_SECOND;
const SMOKE_LIFE_TICKS = 1.4 * TICKS_PER_SECOND;
const FLAME_LIFE_TICKS = 1.1 * TICKS_PER_SECOND;
const LIFE_JITTER_TICKS = 18;

const DIRT_COLOR = { red: 0.55, green: 0.38, blue: 0.22 } as const;
const SMOKE_COLOR = { red: 0.46, green: 0.46, blue: 0.5 } as const;
const FLAME_COLOR = { red: 1, green: 0.55, blue: 0.15 } as const;

const DEBRIS_SIZE_WU = 1.4;
const SMOKE_SIZE_WU = 5;
const FLAME_SIZE_WU = 3.4;

const DEBRIS_ALPHA = 1;
const SMOKE_ALPHA = 0.42;
const FLAME_ALPHA = 0.8;

/** The muzzle blast: hot gas thrown out along the barrel when a shot leaves it. */
const MUZZLE_FLASH_PARTICLES = 10;
const MUZZLE_FLASH_SPREAD_RADIANS = 0.45;
const MUZZLE_FLASH_SPEED_WU_PER_TICK = 1.4;
/** A harder shot kicks its gases out harder; the fraction keeps the puff behind the shell. */
const MUZZLE_FLASH_SHELL_SPEED_FRACTION = 0.15;
const MUZZLE_FLASH_LIFE_TICKS = 0.3 * TICKS_PER_SECOND;
const MUZZLE_FLASH_LIFE_JITTER_TICKS = 6;
const MUZZLE_FLASH_SIZE_WU = 2.2;
const MUZZLE_FLASH_HOT_COLOR = { red: 1, green: 0.88, blue: 0.45 } as const;
const MUZZLE_FLASH_EMBER_COLOR = { red: 1, green: 0.45, blue: 0.12 } as const;
const MUZZLE_FLASH_ALPHA = 0.9;

/** A dense little dust cloud over the landing spot, so the shell-to-mine swap happens off-camera. */
const ROLLER_LANDING_PUFF_RADIUS_WU = 6;
const ROLLER_LANDING_PUFF_PER_RADIUS = 1.5;

const POUR_SPLASH_RADIUS_WU = 4;
const POUR_SPLASH_PER_RADIUS = 0.8;

/** The plasma nova: a ring of hot cyan-violet tongues thrown outward from the tank. */
const PLASMA_NOVA_PARTICLES_PER_RADIUS = 0.6;
const PLASMA_NOVA_SPEED_PER_RADIUS = 0.03;
const PLASMA_NOVA_LIFE_TICKS = 0.5 * TICKS_PER_SECOND;
const PLASMA_NOVA_SIZE_WU = 3;
const PLASMA_NOVA_CORE_COLOR = { red: 0.55, green: 0.95, blue: 1 } as const;
const PLASMA_NOVA_EDGE_COLOR = { red: 0.65, green: 0.4, blue: 1 } as const;
const PLASMA_NOVA_ALPHA = 0.85;

function countFor(radiusWu: number, perRadius: number): number {
  return Math.min(MAX_PARTICLES_PER_BURST, Math.max(1, Math.round(radiusWu * perRadius)));
}

function createDebris(centerX: number, centerY: number, radiusWu: number): ParticleInstance {
  const angleRadians = random(0, 2 * Math.PI, IS_FLOATING);
  const speed = random(0.2, 1, IS_FLOATING) * radiusWu * DEBRIS_SPEED_PER_RADIUS_WU;

  return {
    x: centerX,
    y: centerY,
    velocityX: Math.cos(angleRadians) * speed,
    velocityY: Math.abs(Math.sin(angleRadians)) * speed,
    lifespanTicks: DEBRIS_LIFE_TICKS + random(-LIFE_JITTER_TICKS, LIFE_JITTER_TICKS),
    sizeWu: DEBRIS_SIZE_WU,
    kind: PARTICLE_KIND.debris,
    ...DIRT_COLOR,
    alpha: DEBRIS_ALPHA,
  };
}

function createSmoke(centerX: number, centerY: number, radiusWu: number): ParticleInstance {
  return {
    x: centerX + random(-radiusWu, radiusWu, IS_FLOATING),
    y: centerY + random(0, radiusWu, IS_FLOATING),
    velocityX: random(-SMOKE_DRIFT_WU_PER_TICK, SMOKE_DRIFT_WU_PER_TICK, IS_FLOATING),
    velocityY: SMOKE_RISE_WU_PER_TICK,
    lifespanTicks: SMOKE_LIFE_TICKS + random(-LIFE_JITTER_TICKS, LIFE_JITTER_TICKS),
    sizeWu: SMOKE_SIZE_WU,
    kind: PARTICLE_KIND.smoke,
    ...SMOKE_COLOR,
    alpha: SMOKE_ALPHA,
  };
}

function createFlame(columnIndex: number, surfaceY: number): ParticleInstance {
  return {
    x: columnIndex + 0.5,
    y: surfaceY,
    velocityX: random(-SMOKE_DRIFT_WU_PER_TICK, SMOKE_DRIFT_WU_PER_TICK, IS_FLOATING),
    velocityY: FLAME_RISE_WU_PER_TICK,
    lifespanTicks: FLAME_LIFE_TICKS + random(-LIFE_JITTER_TICKS, LIFE_JITTER_TICKS),
    sizeWu: FLAME_SIZE_WU,
    kind: PARTICLE_KIND.flame,
    ...FLAME_COLOR,
    alpha: FLAME_ALPHA,
  };
}

function createBurst(
  centerX: number,
  centerY: number,
  radiusWu: number,
  create: (centerX: number, centerY: number, radiusWu: number) => ParticleInstance,
  perRadius: number
): ParticleInstance[] {
  return Array.from({ length: countFor(radiusWu, perRadius) }, () =>
    create(centerX, centerY, radiusWu)
  );
}

function createPlasmaNova(
  center: { readonly x: number; readonly y: number },
  radiusWu: number
): ParticleInstance[] {
  const count = Math.min(
    MAX_PARTICLES_PER_BURST,
    Math.max(8, Math.round(radiusWu * PLASMA_NOVA_PARTICLES_PER_RADIUS))
  );

  return Array.from({ length: count }, () => {
    const angle = random(0, 2 * Math.PI, IS_FLOATING);
    const speed = random(0.6, 1, IS_FLOATING) * radiusWu * PLASMA_NOVA_SPEED_PER_RADIUS;
    const heat = random(0, 1, IS_FLOATING);

    return {
      x: center.x,
      y: center.y,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed,
      lifespanTicks: PLASMA_NOVA_LIFE_TICKS + random(-LIFE_JITTER_TICKS, LIFE_JITTER_TICKS),
      sizeWu: PLASMA_NOVA_SIZE_WU,
      kind: PARTICLE_KIND.flame,
      red:
        PLASMA_NOVA_CORE_COLOR.red +
        (PLASMA_NOVA_EDGE_COLOR.red - PLASMA_NOVA_CORE_COLOR.red) * heat,
      green:
        PLASMA_NOVA_CORE_COLOR.green +
        (PLASMA_NOVA_EDGE_COLOR.green - PLASMA_NOVA_CORE_COLOR.green) * heat,
      blue:
        PLASMA_NOVA_CORE_COLOR.blue +
        (PLASMA_NOVA_EDGE_COLOR.blue - PLASMA_NOVA_CORE_COLOR.blue) * heat,
      alpha: PLASMA_NOVA_ALPHA,
    };
  });
}

function createMuzzleFlash(
  position: { readonly x: number; readonly y: number },
  velocity: { readonly x: number; readonly y: number }
): ParticleInstance[] {
  const barrelAngle = Math.atan2(velocity.y, velocity.x);
  const shellSpeed = Math.hypot(velocity.x, velocity.y);

  return Array.from({ length: MUZZLE_FLASH_PARTICLES }, () => {
    const angle =
      barrelAngle + random(-MUZZLE_FLASH_SPREAD_RADIANS, MUZZLE_FLASH_SPREAD_RADIANS, IS_FLOATING);
    const speed =
      random(0.5, 1, IS_FLOATING) *
      (MUZZLE_FLASH_SPEED_WU_PER_TICK + shellSpeed * MUZZLE_FLASH_SHELL_SPEED_FRACTION);
    const heat = random(0, 1, IS_FLOATING);

    return {
      x: position.x,
      y: position.y,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed,
      lifespanTicks:
        MUZZLE_FLASH_LIFE_TICKS +
        random(-MUZZLE_FLASH_LIFE_JITTER_TICKS, MUZZLE_FLASH_LIFE_JITTER_TICKS),
      sizeWu: MUZZLE_FLASH_SIZE_WU,
      kind: PARTICLE_KIND.flame,
      red:
        MUZZLE_FLASH_HOT_COLOR.red +
        (MUZZLE_FLASH_EMBER_COLOR.red - MUZZLE_FLASH_HOT_COLOR.red) * heat,
      green:
        MUZZLE_FLASH_HOT_COLOR.green +
        (MUZZLE_FLASH_EMBER_COLOR.green - MUZZLE_FLASH_HOT_COLOR.green) * heat,
      blue:
        MUZZLE_FLASH_HOT_COLOR.blue +
        (MUZZLE_FLASH_EMBER_COLOR.blue - MUZZLE_FLASH_HOT_COLOR.blue) * heat,
      alpha: MUZZLE_FLASH_ALPHA,
    };
  });
}

/**
 * One wave of the standing fire. Waves come sparser than the ignition burst but overlap across
 * flame lifetimes, so a burning pool reads as one continuous blaze rather than turn-end flashes.
 */
export function createBurningPoolFlames(pools: readonly NapalmPool[]): readonly ParticleInstance[] {
  const flames: ParticleInstance[] = [];

  for (const pool of pools) {
    for (
      let offset = random(BURNING_WAVE_STRIDE_COLUMNS - 1);
      offset < pool.surfaceHeights.length && flames.length < MAX_FLAMES_PER_POOL;
      offset += BURNING_WAVE_STRIDE_COLUMNS
    ) {
      flames.push(createFlame(pool.firstColumn + offset, pool.surfaceHeights[offset]));
    }
  }

  return flames;
}

function createPoolFlames(pool: NapalmPool): ParticleInstance[] {
  const flames: ParticleInstance[] = [];

  for (
    let offset = 0;
    offset < pool.surfaceHeights.length && flames.length < MAX_FLAMES_PER_POOL;
    offset += FLAME_COLUMN_STRIDE
  ) {
    flames.push(createFlame(pool.firstColumn + offset, pool.surfaceHeights[offset]));
  }

  return flames;
}

/**
 * [§11.2] Turns the round's events into the cosmetic burst that goes with them: dirt spray where
 * the ground was moved, smoke over an explosion, fire above a napalm pool. Nothing here touches
 * gameplay — the damage was already resolved in the domain before the event was emitted.
 */
export function createEventParticles(events: readonly WorldEvent[]): readonly ParticleInstance[] {
  const particles: ParticleInstance[] = [];

  for (const event of events) {
    switch (event.type) {
      case 'projectile-launched':
        particles.push(...createMuzzleFlash(event.position, event.velocity));
        break;
      case 'plasma-fired':
        particles.push(...createPlasmaNova(event.center, event.radiusWu));
        break;
      case 'dirt-poured':
        particles.push(
          ...createBurst(
            event.position.x,
            event.position.y,
            POUR_SPLASH_RADIUS_WU,
            createDebris,
            POUR_SPLASH_PER_RADIUS
          )
        );
        break;
      // The puff that hides the shell turning into a crawling mine.
      case 'roller-landed':
        particles.push(
          ...createBurst(
            event.position.x,
            event.position.y,
            ROLLER_LANDING_PUFF_RADIUS_WU,
            createSmoke,
            ROLLER_LANDING_PUFF_PER_RADIUS
          )
        );
        break;
      case 'explosion':
        particles.push(
          ...createBurst(
            event.position.x,
            event.position.y,
            event.radiusWu,
            createSmoke,
            SMOKE_PER_RADIUS_WU
          )
        );
        break;
      case 'terrain-carved':
      case 'terrain-deposited':
        particles.push(
          ...createBurst(
            event.center.x,
            event.center.y,
            event.radiusWu,
            createDebris,
            DEBRIS_PER_RADIUS_WU
          )
        );
        break;
      case 'napalm-pooled':
        for (const pool of event.pools) {
          particles.push(...createPoolFlames(pool));
        }
        break;
      default:
        break;
    }
  }

  return particles;
}
