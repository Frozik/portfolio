# @frozik/vault

The core of a zero-knowledge password manager whose only storage is one
encrypted file in the user's own cloud. Everything that matters — the
cryptography, the `.pwv` file format, the card model, the merge and the
sync state machines — is pure TypeScript shared by two clients: the
portfolio demo (`apps/portfolio/src/features/vault`) and the Chrome
extension.

A domain model in a library is a deliberate exception to "shared code is
utilities and UI": the model has two
consumers, so it lives once, in layers that `pnpm layers` keeps apart.

```
src/
  ports/        IRandom, TWallClock — the bottom layer, imports nothing
  crypto/       HKDF, AES-GCM, STREAM, Padmé, key slots, the KDF port and its hash-wasm adapter
  format/       header, envelope, zip container, document schema, migrations, open, seal
  codec/        IVaultCodec: in-thread adapter and the Worker server half
  model/        cards, tabs, fields, field kinds, templates, groups, links, expiry, search
  merge/        merge(local, remote, base?) — last writer per card wins, the loser goes to history
  persistence/  device-local ports and their IndexedDB adapters
  lifecycle/    the lock / unlock state machine — effects as data
  sync/         the sync state machine — effects as data
  session/      the clients' shared shell: runs the machines' effects over the codec and the storage port
  generator/ otp/ audit/ import/ export/ data/
  react/        components shared by both clients, over @frozik/components controls
  theme/        vault.css
  testing/      fakes and test-data builders
```

Folders: `ports/`, `crypto/`, `format/`, `codec/`, `model/`, `merge/`,
`persistence/`, `lifecycle/`, `sync/`, `session/`, `generator/`, `otp/`,
`audit/`, `data/`, `import/`, `export/`, `react/` and `testing/`.

## What holds it together

- **Crypto** — AES-256-GCM in an age-style STREAM (the last chunk is marked
  in its nonce), the header's SHA-256 as additional data of every chunk,
  Padmé padding, HKDF subkeys, Argon2id (hash-wasm) behind a port with a
  floor and a ceiling checked before any KDF runs, key slots like LUKS.
  Tested against RFC 5869, the GCM specification, the Argon2 reference
  vectors and known answers produced by an independent implementation.
- **Format** — `.pwv`: an authenticated TLV header, then the sealed zip. A
  newer document schema opens read-only and is never written back, so an
  older client cannot erase what it does not understand; unknown field kinds
  are shown as such instead of failing the file.
- **Golden files** — `fixtures/v1.0/*.pwv` freeze the format. Regenerate them
  only on purpose (`pnpm --filter @frozik/vault run generate-fixtures`) and
  review the diff.
- **Model** — immutable cards with tabs and typed fields, edits as pure
  functions stamped with a hybrid logical clock, history, smart groups in one
  pass, URL matching by host by default. Bank details are international:
  IBAN and SWIFT everywhere, national codes (ABA routing, sort code, BSB,
  IFSC, …) as schemes, any other code taken as typed.
- **Merge** — `mergeDocument(local, remote)` is commutative, associative and
  idempotent (property-tested): the later card version wins and the other one
  goes to history, tombstones win over older edits, HOTP counters only rise.
- **Import and export** — every source is read into one neutral shape
  (`import/imported-card.ts`: cards with labels as translation keys or the
  source's own text), and one edit (`applyImport`) gives it ids, finds groups
  by name and settles duplicates (same registrable domain and login: skip,
  replace keeping history, or keep both); the preview is that edit run on a
  copy, so the two cannot disagree. Sources: the browser CSVs (Chrome/Edge,
  Firefox, Safari — told apart by their headers), SafeInCloud XML and its
  sealed `.db` (PBKDF2-SHA1 and AES-CBC through WebCrypto, then zlib — the same
  XML inside; a check value tells a wrong password from a damaged file), Bitwarden
  JSON and CSV, another `.pwv` opened with its own password. Exports: the open
  zip (the container plus each card's files by name) and Bitwarden-style CSV,
  which reads back in; the sealed copy with its own password is the codec's
  `createKeys` + `seal`. Each importer is tested on fixtures shaped like the
  real exports (`testing/import-fixtures.ts`, made-up data).

## Layers

| Rule | What it keeps apart |
|---|---|
| `vault-ports-are-bottom` | ports import nothing from the package |
| `vault-model-is-innermost` | model and merge see only the model and the ports |
| `vault-crypto-is-below-format` | primitives never know the format or the cards |
| `vault-sync-sees-format-and-storage-core` | the sync engine never names a provider, the codec or the UI |
| `vault-importers-are-independent` | importers meet only through the model |
| `vault-react-is-outermost` | only `react/` knows React |
| `vault-core-is-platform-free` | no storage or WASM package outside `react/`, `persistence/` and `adapters/` |
| `vault-sees-only-storage-core` | only `@frozik/cloud-storage/core/*` is visible |

Outside `react/`, `persistence/` and `adapters/`, an oxlint override also bans
`fetch`, `indexedDB`, `document`, `window` and the other platform globals.
