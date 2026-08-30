import { MIN_TREE_EXTENT_METERS } from '../constants';
import type { TreeInstance, TreeSpecies } from '../model/site-plan';
import type { Meters } from '../units';
import type { WorldPoint } from '../view/world-frame';
import { planToWorld } from '../view/world-frame';
import type { Heightfield } from './heightfield';
import { sampleHeight } from './heightfield';

/**
 * A tree ready for the 3D view: where its trunk meets the ground, and the two
 * sizes the species template is stretched by.
 */
export interface SceneTree {
  readonly species: TreeSpecies;
  /** Foot of the trunk, in world space, on the interpolated terrain. */
  readonly position: WorldPoint;
  readonly crownRadius: Meters;
  readonly height: Meters;
}

/**
 * Stands every tree on the sampled terrain (A4: a tree has no elevation of its
 * own — the ground under it is the only thing that decides where its foot is).
 * Re-deriving them is therefore how a surveyed elevation reaches the trees:
 * change the marks and the whole orchard settles onto the new ground.
 */
export function placeTreesOnTerrain(
  trees: readonly TreeInstance[],
  field: Heightfield
): readonly SceneTree[] {
  return trees.map(tree => ({
    species: tree.species,
    position: planToWorld(tree.position, sampleHeight(field, tree.position.x, tree.position.y)),
    // A tree typed down to nothing would collapse its instance scale, and with
    // it the normals the template is lit by.
    crownRadius: Math.max(tree.crownRadius, MIN_TREE_EXTENT_METERS),
    height: Math.max(tree.height, MIN_TREE_EXTENT_METERS),
  }));
}
