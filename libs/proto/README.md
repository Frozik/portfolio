# @frozik/proto

The protobuf contract between the browser and the server for the services
that run over [`@frozik/transport`](../transport/README.md), and the
TypeScript generated from it. Both are committed.

```
proto/frozik/transport/v1/plot.proto   → src/gen/frozik/transport/v1/plot_pb.ts
proto/frozik/transport/v1/file.proto   → src/gen/frozik/transport/v1/file_pb.ts
```

Import the generated file directly:
`import { PlotService } from '@frozik/proto/frozik/transport/v1/plot_pb'`.
Generated types are the wire: the server translates them in `presentation/`,
the browser in `infrastructure/`, and dependency-cruiser keeps them out of
every `domain/` and `application/`.

## Versioning

The portfolio and the server deploy separately, so an old page meets a new
server and the other way round. Compatibility on the wire is what is
versioned, not the npm package:

- the package carries its version, `frozik.transport.v1`. Inside `v1` only
  additions are allowed: new fields, methods, services. A removed field's
  number and name go to `reserved`;
- a breaking change is a new package, `v2`, next to `v1`; the server serves
  both until no page uses `v1`;
- because JSON travels too, a field's name is part of the contract
  (`buf breaking` runs with `WIRE_JSON`).

## Tasks

| Task | What it does |
| --- | --- |
| `moon run proto:generate` | regenerate `src/gen` after editing a `.proto` |
| `proto:proto-lint` | `buf lint` (standard rules) |
| `proto:proto-breaking` | `buf breaking` against `origin/main` |
| `proto:proto-fresh` | fails when `src/gen` is not what the `.proto` files generate |

The last three run in `pnpm check-all` and in CI. `uint64` fields arrive as
`bigint` (protobuf-es ignores `jstype`); convert them where they are read.
