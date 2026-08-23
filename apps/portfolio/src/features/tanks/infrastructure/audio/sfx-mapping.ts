import { assertNever } from '@frozik/utils/assert/assertNever';
import { uniq } from 'lodash-es';

import type { BulletEndReason, WorldEvent } from '../../domain/types';
import type { SfxId } from './sfx-recipes';

/** A tank hit is silent — the kill plays its own explosion; bullet-on-bullet is silent (§7). */
function mapBulletEnd(reason: BulletEndReason): SfxId | undefined {
  switch (reason) {
    case 'terrain':
      return 'brick-crumble';
    case 'steel':
    case 'border':
      return 'steel-clang';
    case 'eagle':
      return 'big-explosion';
    case 'tank':
    case 'bullet':
      return undefined;
    default:
      return assertNever(reason);
  }
}

function mapWorldEvent(event: WorldEvent): SfxId | undefined {
  switch (event.type) {
    case 'bullet-fired':
      // Only the player's gun is heard; four enemies firing at 1/32 a tick would be a rattle.
      return event.owner.side === 'player' ? 'shot' : undefined;
    case 'bullet-ended':
      return mapBulletEnd(event.reason);
    case 'enemy-destroyed':
      return 'small-explosion';
    case 'player-destroyed':
    case 'base-destroyed':
      return 'big-explosion';
    case 'power-up-spawned':
      return 'power-up-appear';
    case 'power-up-taken':
      return 'power-up-pickup';
    case 'extra-life-awarded':
      return 'extra-life';
    case 'player-ice-slide-started':
      return 'ice-skid';
    // The flow moments are scored by the application layer's jingles, not by the event stream.
    case 'stage-started':
    case 'stage-cleared':
    case 'game-over':
    case 'enemy-spawned':
    case 'score-awarded':
      return undefined;
    default:
      return assertNever(event);
  }
}

/** Each sound at most once per tick — four brick crumbles on one instant read as one crunch (§12.3). */
export function mapWorldEventsToSfx(events: readonly WorldEvent[]): readonly SfxId[] {
  const sounds: SfxId[] = [];

  for (const event of events) {
    const sfxId = mapWorldEvent(event);

    if (sfxId !== undefined) {
      sounds.push(sfxId);
    }
  }

  return uniq(sounds);
}
