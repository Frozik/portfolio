import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { decodePack, encodePack } from '@frozik/navigation-pack/codec';
import type { Profile } from '@frozik/navigation-pack/format';
import { PACK_FORMAT_VERSION, PROFILES } from '@frozik/navigation-pack/format';
import { Router } from '@frozik/navigation-pack/router';
import { buildEdgeIndex, snapToEdge } from '@frozik/navigation-pack/snap';
import { isNil } from 'lodash-es';

import { collectBuildingStats } from './building-stats';
import { buildRoutingGraph } from './graph/build-graph';

const SNAP_METRES = 300;
const DEFAULT_BENCH_ROUTES = 100;

function usage(): never {
  console.error(`Usage:
  pack build --pbf <extract.osm.pbf> --out <region.graph>
  pack stats --pbf <extract.osm.pbf>
  pack route --pack <region.graph> --profile car|foot|bike --from lat,lon --to lat,lon
  pack bench --pack <region.graph> [--count 100] [--seed 1]`);
  process.exit(2);
}

function parseLatLon(value: string | undefined): { lat: number; lon: number } {
  const parts = (value ?? '').split(',').map(Number);
  if (parts.length !== 2 || parts.some(Number.isNaN)) {
    usage();
  }
  return { lat: parts[0], lon: parts[1] };
}

function parseProfile(value: string | undefined): Profile {
  if (!PROFILES.includes(value as Profile)) {
    usage();
  }
  return value as Profile;
}

/** Deterministic pseudo-random numbers so bench runs are comparable across machines. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    pbf: { type: 'string' },
    out: { type: 'string' },
    pack: { type: 'string' },
    profile: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' },
    count: { type: 'string' },
    seed: { type: 'string' },
  },
});

const command = positionals[0];

if (command === 'build') {
  if (isNil(values.pbf) || isNil(values.out)) {
    usage();
  }
  const started = performance.now();
  const { graph, stats } = buildRoutingGraph(values.pbf);
  const bytes = encodePack(graph);
  writeFileSync(values.out, bytes);
  console.log(
    JSON.stringify(
      {
        ...stats,
        packFormatVersion: PACK_FORMAT_VERSION,
        nodes: graph.nodeCount,
        edges: graph.edgeCount,
        geometryPoints: graph.geometryLon.length,
        names: graph.names.length,
        restrictions: graph.restrictionFromEdge.length,
        packBytes: bytes.length,
        seconds: Math.round((performance.now() - started) / 100) / 10,
      },
      null,
      2
    )
  );
} else if (command === 'stats') {
  if (isNil(values.pbf)) {
    usage();
  }
  console.log(JSON.stringify(collectBuildingStats(values.pbf), null, 2));
} else if (command === 'route' || command === 'bench') {
  if (isNil(values.pack)) {
    usage();
  }
  const loadStarted = performance.now();
  const graph = decodePack(new Uint8Array(readFileSync(values.pack)));
  const router = new Router(graph);
  const index = buildEdgeIndex(graph);
  const loadMs = performance.now() - loadStarted;

  if (command === 'route') {
    const profile = parseProfile(values.profile);
    const from = parseLatLon(values.from);
    const to = parseLatLon(values.to);
    const origin = snapToEdge(graph, index, from.lon, from.lat, profile, SNAP_METRES);
    const destination = snapToEdge(graph, index, to.lon, to.lat, profile, SNAP_METRES);
    if (isNil(origin) || isNil(destination)) {
      console.error('no road within snapping distance');
      process.exit(1);
    }
    const started = performance.now();
    const route = router.route(profile, origin, destination);
    const routeMs = performance.now() - started;
    if (isNil(route)) {
      console.error('no route');
      process.exit(1);
    }
    console.log(
      JSON.stringify(
        {
          loadMs: Math.round(loadMs),
          routeMs: Math.round(routeMs * 10) / 10,
          distanceMetres: Math.round(route.distanceMetres),
          durationSeconds: Math.round(route.durationSeconds),
          edges: route.edges.length,
          settledStates: route.settledStates,
          streets: [
            ...new Set(route.edges.map(edge => graph.names[graph.edgeNameIndex[edge.edge]])),
          ].filter(Boolean),
        },
        null,
        2
      )
    );
  } else {
    const count = Number(values.count ?? DEFAULT_BENCH_ROUTES);
    const random = createRandom(Number(values.seed ?? 1));
    const timings: number[] = [];
    const distances: number[] = [];
    let unroutable = 0;
    const profiles: Profile[] = ['car', 'foot', 'bike'];
    for (let attempt = 0; attempt < count; attempt++) {
      const profile = profiles[attempt % profiles.length];
      const a = Math.floor(random() * graph.nodeCount);
      const b = Math.floor(random() * graph.nodeCount);
      const origin = snapToEdge(
        graph,
        index,
        graph.nodeLon[a] / 1e6,
        graph.nodeLat[a] / 1e6,
        profile,
        SNAP_METRES
      );
      const destination = snapToEdge(
        graph,
        index,
        graph.nodeLon[b] / 1e6,
        graph.nodeLat[b] / 1e6,
        profile,
        SNAP_METRES
      );
      if (isNil(origin) || isNil(destination)) {
        unroutable++;
        continue;
      }
      const started = performance.now();
      const route = router.route(profile, origin, destination);
      timings.push(performance.now() - started);
      if (isNil(route)) {
        unroutable++;
      } else {
        distances.push(route.distanceMetres);
      }
    }
    timings.sort((x, y) => x - y);
    const percentile = (fraction: number): number =>
      Math.round(timings[Math.min(timings.length - 1, Math.floor(timings.length * fraction))] ?? 0);
    console.log(
      JSON.stringify(
        {
          loadMs: Math.round(loadMs),
          routes: count,
          unroutable,
          medianMs: percentile(0.5),
          p90Ms: percentile(0.9),
          maxMs: percentile(1),
          medianDistanceKm:
            Math.round(
              ((distances.sort((x, y) => x - y)[Math.floor(distances.length / 2)] ?? 0) / 1000) * 10
            ) / 10,
        },
        null,
        2
      )
    );
  }
} else {
  usage();
}
