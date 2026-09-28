import { signedArea } from './ring-area';
import { clipRingToTile } from './tile-clip';

const EXTENT = 4096;
const BUFFER = 64;

/** An ocean tile as the vector tile stores it: the square plus its buffer, clockwise in tile space. */
const OCEAN_RING = [
  { x: -BUFFER, y: -BUFFER },
  { x: EXTENT + BUFFER, y: -BUFFER },
  { x: EXTENT + BUFFER, y: EXTENT + BUFFER },
  { x: -BUFFER, y: EXTENT + BUFFER },
];

describe('tile clipping', () => {
  it('cuts a ring to the tile square, keeping its winding', () => {
    const clipped = clipRingToTile(OCEAN_RING, EXTENT);

    expect(clipped).toHaveLength(4);
    expect(clipped).toContainEqual({ x: 0, y: 0 });
    expect(clipped).toContainEqual({ x: EXTENT, y: EXTENT });
    expect(Math.sign(signedArea(clipped))).toBe(Math.sign(signedArea(OCEAN_RING)));
  });

  it('drops a ring that lies wholly in the buffer or is left without area', () => {
    const beyond = OCEAN_RING.map(point => ({ x: point.x - EXTENT - 2 * BUFFER, y: point.y }));
    const alongEdge = [
      { x: -10, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: -10 },
    ];

    expect(clipRingToTile(beyond, EXTENT)).toHaveLength(0);
    expect(clipRingToTile(alongEdge, EXTENT)).toHaveLength(0);
  });
});
