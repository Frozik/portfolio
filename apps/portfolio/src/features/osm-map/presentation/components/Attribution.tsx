import { memo } from 'react';

import { osmMapT } from '../translations';

const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

/** Required by the OSM tile usage policy: always visible, never behind a toggle. */
export const Attribution = memo(() => (
  <a
    href={OSM_COPYRIGHT_URL}
    target="_blank"
    rel="noreferrer"
    className="absolute right-2 bottom-2 rounded bg-white/80 px-2 py-0.5 text-xs text-neutral-700 hover:underline"
  >
    {osmMapT.attribution}
  </a>
));
