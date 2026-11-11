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
  sync/         the sync state machine — effects as data
  session/      the clients' shared shell: runs the machines' effects over the codec and the storage port
  generator/ otp/ audit/ import/ export/ data/
  theme/        vault.css
  testing/      fakes and test-data builders
```

Folders: `ports/`, `crypto/`, `format/`, `codec/`, `model/`, `merge/`,
`persistence/`, `sync/`, `session/`, `generator/`, `otp/`, `audit/`, `data/`,
`import/`, `export/` and `testing/`. The lock lifecycle lives in
`@frozik/vault-app` (`session/domain`), the React widgets in `@frozik/vault-react`.

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
  are shown as such instead of failing the file. Format 1.1 names the site
  each passkey belongs to in a skippable header record. A 1.0 client opens
  the file but drops the record when it saves; a passkey without an entry has
  an unknown site and is offered everywhere, as in 1.0, while one with an
  entry is offered only on its site (`passkeysOf(file, rpId)`). From 1.1 on a
  session keeps every skippable record it does not know (`IVaultKeys.preserved`)
  and writes it back.
- **The vault's own cache** — `meta/` in the sealed zip, never shown (`model/vault-meta.ts`,
  `format/meta-codec.ts`): work done once so no device redoes it. Its first section,
  `meta/password-strength.json`, holds password strength scores by the meter that gave them
  (`zxcvbn:<language>:<rules>`), then by the password's SHA-256 — under the vault's own sealing,
  so it says nothing the passwords beside it do not. Devices' sections merge by union (one meter
  gives one password one score); each write drops the hashes of passwords no card holds any more.
  It does not raise the schema version: an older client opens the vault as before and drops the
  cache when it saves, which costs a recount, never data; a damaged cache reads as empty.
- **Golden files** — `fixtures/v1.0/*.pwv` freeze the format. Regenerate them
  only on purpose (`pnpm --filter @frozik/vault run generate-fixtures`) and
  review the diff. `testing/format-v1-0.ts` states what a 1.0 reader accepts
  and what a 1.0 client's save keeps, for tests of every later minor version.
- **Contract suites** — `testing/device-stores-contract.ts` (the device
  stores every client's storage passes) and `testing/subtle-crypto-contract.ts`
  (the WebCrypto calls the core makes, with RFC/NIST known answers), run here
  on IndexedDB and Node and later on each new platform's adapters.
- **Model** — immutable cards with tabs and typed fields, edits as pure
  functions stamped with a hybrid logical clock, history, smart groups in one
  pass, URL matching by host by default. Bank details are international:
  IBAN and SWIFT everywhere, national codes (ABA routing, sort code, BSB,
  IFSC, …) as schemes, any other code taken as typed.
- **Merge** — `mergeDocument(local, remote)` is commutative, associative and
  idempotent (property-tested): the later card version wins and the other one
  goes to history, tombstones win over older edits, HOTP counters only rise. A version deleted
  from a card's history leaves its stamp in the card's optional `forgottenRevisions`; merges unite
  those and drop the versions again, and a build that predates the field reads the card unchanged.
- **Import and export** — every source is read into one neutral shape
  (`import/imported-card.ts`: cards with labels as translation keys or the
  source's own text), and one edit (`applyImport`) gives it ids, finds groups
  by name and settles duplicates (same registrable domain and login: skip,
  replace keeping history, or keep both) — only against the cards the vault had before, each
  the twin of at most one entry, so two entries of one file for one account both come in; the preview is that edit run on a
  copy, so the two cannot disagree. Sources: the browser CSVs (Chrome/Edge,
  Firefox, Safari — told apart by their headers), SafeInCloud XML and its
  sealed `.db` (PBKDF2-SHA1 and AES-CBC through WebCrypto, then zlib — the same
  XML inside; a check value tells a wrong password from a damaged file; its "expiry" holds what was
  typed, so a full day — a document's `10.11.2027` — becomes an expiry date and the rest a card's
  month, `MM/YY`, `MM.YY` or `MM-YY`), Bitwarden
  JSON and CSV, another `.pwv` opened with its own password. Exports: the open
  zip (the container plus each card's files by name), Bitwarden-style CSV and
  SafeInCloud's XML (fields under their names, groups as labels, star and colour) —
  also sealed as SafeInCloud's own `.db` (`export/safeincloud/seal-safeincloud-db.ts`,
  sharing `format/safeincloud-db-format.ts` with the reader) — all of which read back in; the sealed copy with its own password is the codec's
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
| `vault-core-knows-no-react` | no React, React widgets or `@frozik/components` |
| `vault-core-is-platform-free` | no storage or WASM package outside `persistence/` and `adapters/` |
| `vault-sees-only-storage-core` | only `@frozik/cloud-storage/core/*` is visible |

Outside `persistence/` and `adapters/`, an oxlint override also bans
`fetch`, `indexedDB`, `document`, `window` and the other platform globals.
