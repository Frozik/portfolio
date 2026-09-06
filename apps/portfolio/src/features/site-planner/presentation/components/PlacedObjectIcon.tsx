import { assertNever } from '@frozik/utils/assert/assertNever';
import type { ReactNode, SVGProps } from 'react';
import { memo } from 'react';

import type { PlacedObject } from '../../domain/model/placed-object';
import type { TreeSpecies } from '../../domain/model/plot-objects';

const VIEW_BOX = '0 0 24 24';

/**
 * Silhouettes rather than lucide glyphs: the catalogue has to tell a spruce from
 * a pine from a thuja, and the icon set carries one conifer for all three.
 */
export const PlacedObjectIcon = memo(
  ({ object, ...props }: { readonly object: PlacedObject } & SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={VIEW_BOX}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
      width="1em"
      height="1em"
      aria-hidden="true"
      {...props}
    >
      {renderObject(object)}
    </svg>
  )
);

function renderObject(object: PlacedObject): ReactNode {
  switch (object.kind) {
    case 'tree':
      return renderTree(object.species);
    case 'car':
      return renderCar();
    default:
      return assertNever(object);
  }
}

function renderTree(species: TreeSpecies): ReactNode {
  switch (species) {
    // A single tall cone reaching the ground.
    case 'spruce':
      return (
        <>
          <path d="M12 2 5.5 18h13L12 2Z" />
          <path d="M12 18v4" />
        </>
      );
    // A bare trunk with the needles gathered in a cap on top.
    case 'pine':
      return (
        <>
          <path d="M12 3 7 11h10L12 3Z" />
          <path d="M12 3.5 8.8 15h6.4L12 3.5Z" />
          <path d="M12 15v7" />
        </>
      );
    // A narrow column standing on the ground.
    case 'thuja':
      return (
        <>
          <path d="M12 2c2.6 2.6 3.4 6.6 3.4 9.6 0 4.4-1.5 8-3.4 8s-3.4-3.6-3.4-8C8.6 8.6 9.4 4.6 12 2Z" />
          <path d="M12 19.6V22" />
        </>
      );
    // A round crown on a taller trunk.
    case 'deciduous':
      return (
        <>
          <circle cx="12" cy="9" r="6" />
          <path d="M12 15v7" />
        </>
      );
    default:
      return assertNever(species);
  }
}

/** A car from above, the way the plan draws it: a body with a nose and wheels. */
function renderCar(): ReactNode {
  return (
    <>
      <path d="M4 8.5h11.5L20 12l-4.5 3.5H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Z" />
      <path d="M6 8.5V6.8M6 15.5v1.7M12 8.5V6.8M12 15.5v1.7" />
    </>
  );
}
