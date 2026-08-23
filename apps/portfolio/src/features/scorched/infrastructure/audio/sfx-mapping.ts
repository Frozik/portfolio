import { assertNever } from '@frozik/utils/assert/assertNever';
import { uniq } from 'lodash-es';

import type { DamageCause, WorldEvent } from '../../domain/types';
import type { ScorchedSfxId } from './sfx-recipes';

/** [§12.2] Explosions are voiced by size, so a baby missile never sounds like a nuke. */
const MEDIUM_EXPLOSION_RADIUS_WU = 25;
const LARGE_EXPLOSION_RADIUS_WU = 50;

function mapExplosion(radiusWu: number): ScorchedSfxId {
  if (radiusWu >= LARGE_EXPLOSION_RADIUS_WU) {
    return 'large-explosion';
  }

  return radiusWu >= MEDIUM_EXPLOSION_RADIUS_WU ? 'medium-explosion' : 'small-explosion';
}

/** A fall or a napalm burn is scored by its own cue; a blast already banged when it went off. */
function mapDamage(cause: DamageCause): ScorchedSfxId | undefined {
  switch (cause) {
    case 'napalm':
      return 'napalm-crackle';
    case 'blast':
    case 'laser':
    case 'direct-hit':
      return undefined;
    default:
      return assertNever(cause);
  }
}

/**
 * The one sound a single world event asks for. Exhaustive on purpose: a new event type must be
 * given a voice — or explicitly denied one — rather than silently falling through.
 */
function mapWorldEvent(event: WorldEvent): ScorchedSfxId | undefined {
  switch (event.type) {
    case 'projectile-launched':
      // Only the shell that left the barrel whistles; nine MIRV warheads would be a siren.
      return event.position.y > 0 ? 'shot' : undefined;
    case 'explosion':
      return mapExplosion(event.radiusWu);
    case 'projectile-bounced':
      return 'wall-bounce';
    case 'laser-fired':
      return 'laser-zap';
    case 'dirt-settled':
      return 'dirt-rumble';
    case 'shield-absorbed':
    // A bubble going up gets the same energised chirp it makes when something lands on it: one
    // shield note is enough vocabulary for an accessory the player watches appear on the field.
    case 'shield-raised':
      return 'shield-hit';
    case 'shield-deflected':
      return 'shield-deflect';
    case 'mag-deflected':
      return 'mag-deflect';
    case 'tank-repaired':
      return 'battery-charge';
    case 'tank-retreated':
      return 'retreat-helicopter';
    case 'napalm-pooled':
      return 'napalm-crackle';
    case 'roller-landed':
      return 'dirt-rumble';
    case 'plasma-fired':
      return 'laser-zap';
    case 'tank-damaged':
      return mapDamage(event.cause);
    case 'tank-destroyed':
      return 'large-explosion';
    // Everything else is either silent by design or scored by the controller's own jingles.
    case 'round-started':
    case 'round-ended':
    case 'turn-started':
    case 'turn-ended':
    case 'wind-changed':
    case 'projectile-ended':
    case 'terrain-carved':
    case 'terrain-deposited':
    case 'shield-collapsed':
    case 'tank-fell':
    // Fourteen pours in a second would turn the rumble into a machine gun; the final
    // dirt-settled plays the one freeze note instead.
    case 'dirt-poured':
    // Driving is silent by design: the wind ambience is the only bed an aiming turn has, and an
    // engine note under every arrow-key press would sit on top of it for the whole turn.
    case 'tank-moved':
      return undefined;
    default:
      return assertNever(event);
  }
}

/**
 * One frame's events reduced to the sounds to play, each at most once: a funky bomb scatters ten
 * bursts in a single tick, and ten explosions stacked on the same instant read as one distorted
 * crunch rather than as ten bombs.
 */
export function mapScorchedEventsToSfx(events: readonly WorldEvent[]): readonly ScorchedSfxId[] {
  const sounds: ScorchedSfxId[] = [];

  for (const event of events) {
    const sfxId = mapWorldEvent(event);

    if (sfxId !== undefined) {
      sounds.push(sfxId);
    }
  }

  return uniq(sounds);
}
