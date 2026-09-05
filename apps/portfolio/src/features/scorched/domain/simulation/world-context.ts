import { COLLAPSE_GRAVITY_WU_PER_TICK_SQUARED, COLLAPSE_SETTLE_MARGIN_TICKS } from '../constants';
import type { ImpactResolutionContext } from '../impact-resolution';
import { detonate } from '../impact-resolution';
import type { ProjectileFlightContext } from '../projectile-flight';
import type { Projectile } from '../types';
import { applyDamage, applyShieldAbsorption } from './damage';
import { createRoundEnvironment } from './environment';
import { spawnWarhead } from './firing';
import type { RoundState } from './round-state';

export type RoundWorldContext = ProjectileFlightContext & ImpactResolutionContext;

function removeProjectile(state: RoundState, projectile: Projectile): void {
  state.projectiles = state.projectiles.filter(candidate => candidate !== projectile);
}

/** Falling ground keeps the turn in flight until the last grain has landed. */
function extendSettleByDrop(state: RoundState, dropWu: number): void {
  if (dropWu <= 0) {
    return;
  }

  const fallTicks = Math.ceil(Math.sqrt((2 * dropWu) / COLLAPSE_GRAVITY_WU_PER_TICK_SQUARED));

  state.settleTicksRemaining = Math.max(
    state.settleTicksRemaining,
    fallTicks + COLLAPSE_SETTLE_MARGIN_TICKS
  );
}

/** What flight and impact resolution are allowed to do to the round, as one closure over it. */
export function createWorldContext(state: RoundState): RoundWorldContext {
  const context: RoundWorldContext = {
    getField: () => state.field,
    setField: field => {
      state.field = field;
    },
    getTanks: () => state.tanks,
    getPhysics: () => state.options.physics,
    getMagDeflectors: () => state.magDeflectors,
    setMagDeflectors: deflectors => {
      state.magDeflectors = deflectors;
    },
    createEnvironment: guidance => createRoundEnvironment(state, guidance),
    pushEvent: event => {
      state.events.push(event);
    },
    getTank: playerId => state.tanks.find(tank => tank.playerId === playerId),
    spawnWarhead: (parent, projectileState, blastRadiusWu, stageIndex) =>
      spawnWarhead(state, parent, projectileState, blastRadiusWu, stageIndex),
    removeProjectile: projectile => {
      removeProjectile(state, projectile);
    },
    endProjectile: (projectile, position, reason) => {
      removeProjectile(state, projectile);
      state.events.push({
        type: 'projectile-ended',
        projectileId: projectile.id,
        position,
        reason,
      });
    },
    // A shell that splits mid-flight needs the same context back when its warheads go off.
    detonate: (projectile, impact, isDirectTankHit) => {
      detonate(context, projectile, impact, isDirectTankHit);
    },
    applyShieldAbsorption: (tank, absorption) => {
      applyShieldAbsorption(state, tank, absorption);
    },
    extendSettleByDrop: dropWu => {
      extendSettleByDrop(state, dropWu);
    },
    applyDamage: (playerId, amount, sourceId, cause) => {
      applyDamage(state, playerId, amount, sourceId, cause);
    },
  };

  return context;
}
