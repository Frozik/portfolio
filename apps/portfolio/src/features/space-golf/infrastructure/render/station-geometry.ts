import type { Vector2 } from '@frozik/utils/math/vector2';

import { add, lerp, normalize, rightNormal, scale, subtract } from '../../domain/vector';
import type { MeshData, Rgba } from './mesh-writer';
import { MeshWriter } from './mesh-writer';
import { PALETTE } from './palette';
import type { Station } from './station';
import { STATION_HALF_SPAN_METERS } from './station';

/**
 * A straight piece of the station in its own frame, measured in half spans
 * of the truss: `x` runs along the flight, fore ahead, `y` along the truss.
 */
interface Bar {
  readonly from: Vector2;
  readonly to: Vector2;
  readonly width: number;
}

const TRUSS: Bar = { from: { x: 0, y: -1 }, to: { x: 0, y: 1 }, width: 0.05 };
/** The docking tunnels, seen in the gaps between one module and the next. */
const SPINE: Bar = { from: { x: -0.85, y: 0 }, to: { x: 0.25, y: 0 }, width: 0.035 };
const MODULES: Readonly<Record<string, Bar>> = {
  harmony: { from: { x: 0.12, y: 0 }, to: { x: 0.25, y: 0 }, width: 0.085 },
  destiny: { from: { x: -0.06, y: 0 }, to: { x: 0.1, y: 0 }, width: 0.08 },
  unity: { from: { x: -0.19, y: 0 }, to: { x: -0.08, y: 0 }, width: 0.085 },
  zarya: { from: { x: -0.45, y: 0 }, to: { x: -0.21, y: 0 }, width: 0.075 },
  zvezda: { from: { x: -0.71, y: 0 }, to: { x: -0.47, y: 0 }, width: 0.075 },
  progress: { from: { x: -0.85, y: 0 }, to: { x: -0.73, y: 0 }, width: 0.05 },
  columbus: { from: { x: 0.185, y: 0.04 }, to: { x: 0.185, y: 0.17 }, width: 0.075 },
  kibo: { from: { x: 0.185, y: -0.04 }, to: { x: 0.185, y: -0.25 }, width: 0.08 },
  quest: { from: { x: -0.135, y: 0.04 }, to: { x: -0.135, y: 0.14 }, width: 0.07 },
  tranquility: { from: { x: -0.135, y: -0.04 }, to: { x: -0.135, y: -0.17 }, width: 0.075 },
};
/** Where across a module the highlight runs: the light falls from one side, so it reads as round. */
const HIGHLIGHT_SHARE = 0.35;
const HALF = 0.5;

const WING_STATIONS = [-0.9, -0.64, 0.64, 0.9];
const WING_ROOT = 0.07;
const WING_TIP = 0.72;
const WING_WIDTH = 0.2;
const SERVICE_WING_AT = -0.59;
const SERVICE_WING_ROOT = 0.05;
const SERVICE_WING_TIP = 0.33;
const SERVICE_WING_WIDTH = 0.07;
const FORE_AND_AFT = [1, -1];
const RIB_PITCH = 0.13;
const RIB_WIDTH = 0.02;
const MAST_WIDTH = 0.028;

const RADIATOR_STATIONS = [-0.38, -0.31, -0.24, 0.24, 0.31, 0.38];
const RADIATOR_ROOT = -0.04;
const RADIATOR_TIP = -0.44;
const RADIATOR_WIDTH = 0.055;

/**
 * The station as it flies, drawn between the deep sky and the dust: eight
 * wings of solar cells fore and aft of a truss that lies across the flight,
 * radiators trailing behind it, and the modules strung along the way it
 * set out. Its colours are opaque on purpose: what overlaps is one thing seen
 * from above, and a translucent hull would show every joint twice as bright.
 */
export function buildStationMesh(station: Station | undefined): MeshData {
  const writer = new MeshWriter();
  if (station === undefined) {
    return writer.finish();
  }
  const pen = { writer, station };
  for (const wing of wings()) {
    writePanel(pen, wing);
  }
  for (const across of RADIATOR_STATIONS) {
    writeFlat(
      pen,
      {
        from: { x: RADIATOR_ROOT, y: across },
        to: { x: RADIATOR_TIP, y: across },
        width: RADIATOR_WIDTH,
      },
      PALETTE.stationRadiator
    );
  }
  writeFlat(pen, SPINE, PALETTE.stationHullDark);
  for (const module of Object.values(MODULES)) {
    writeHull(pen, module);
  }
  writeFlat(pen, TRUSS, PALETTE.stationTruss);
  return writer.finish();
}

interface Pen {
  readonly writer: MeshWriter;
  readonly station: Station;
}

function wings(): readonly Bar[] {
  const main = WING_STATIONS.flatMap(across =>
    FORE_AND_AFT.map(side => ({
      from: { x: side * WING_ROOT, y: across },
      to: { x: side * WING_TIP, y: across },
      width: WING_WIDTH,
    }))
  );
  const service = FORE_AND_AFT.map(side => ({
    from: { x: SERVICE_WING_AT, y: side * SERVICE_WING_ROOT },
    to: { x: SERVICE_WING_AT, y: side * SERVICE_WING_TIP },
    width: SERVICE_WING_WIDTH,
  }));
  return [...main, ...service];
}

/** A blanket of cells: ribs across it at every pitch and the mast that holds it out down its middle. */
function writePanel(pen: Pen, bar: Bar): void {
  writeFlat(pen, bar, PALETTE.stationPanel);
  const way = subtract(bar.to, bar.from);
  const half = scale(rightNormal(normalize(way)), bar.width / 2);
  const ribs = Math.floor(Math.hypot(way.x, way.y) / RIB_PITCH);
  for (let rib = 1; rib <= ribs; rib += 1) {
    const at = lerp(bar.from, bar.to, rib / (ribs + 1));
    pen.writer.segment(
      onBoard(pen.station, add(at, half)),
      onBoard(pen.station, subtract(at, half)),
      RIB_WIDTH * STATION_HALF_SPAN_METERS,
      PALETTE.stationPanelRib
    );
  }
  writeFlat(pen, { ...bar, width: MAST_WIDTH }, PALETTE.stationMast);
}

function writeFlat(pen: Pen, bar: Bar, color: Rgba): void {
  pen.writer.segment(
    onBoard(pen.station, bar.from),
    onBoard(pen.station, bar.to),
    bar.width * STATION_HALF_SPAN_METERS,
    color
  );
}

function writeHull(pen: Pen, bar: Bar): void {
  const side = scale(rightNormal(normalize(subtract(bar.to, bar.from))), bar.width);
  const edgeAt = (share: number): readonly [Vector2, Vector2] => {
    const shift = scale(side, share - HALF);
    return [onBoard(pen.station, add(bar.from, shift)), onBoard(pen.station, add(bar.to, shift))];
  };
  const [dark, light] = [PALETTE.stationHullDark, PALETTE.stationHullLight];
  pen.writer.shadedStrip(edgeAt(0), edgeAt(HIGHLIGHT_SHARE), [dark, light]);
  pen.writer.shadedStrip(edgeAt(HIGHLIGHT_SHARE), edgeAt(1), [light, dark]);
}

/** A point of the station's own frame, where it lies on the board. */
function onBoard({ position, attitude }: Station, local: Vector2): Vector2 {
  return {
    x: position.x + (attitude.x * local.x - attitude.y * local.y) * STATION_HALF_SPAN_METERS,
    y: position.y + (attitude.y * local.x + attitude.x * local.y) * STATION_HALF_SPAN_METERS,
  };
}
