# @frozik/vault

The core of a zero-knowledge password manager whose only storage is one
encrypted file in the user's own cloud. Everything that matters — the
cryptography, the `.pwv` file format, the card model, the merge and the
sync state machines — is pure TypeScript shared by two clients: the
portfolio demo (`apps/portfolio/src/features/vault`) and the Chrome
extension.

A domain model in a library is a deliberate exception to "shared code is
utilities and UI" (`.claude/rules/architecture.md`): the model has two
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
  generator/ otp/ audit/ import/ export/ data/
  react/        components shared by both clients, over @frozik/components controls
  theme/        vault.css
  testing/      fakes and test-data builders
```

Only `ports/` exists so far; the rest arrives phase by phase as
`.claude/plan/2026-10-10-password-vault.md` describes. The specifications
are in `.claude/plan/design/vault/` and the code cites them by section.

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
