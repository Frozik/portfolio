# @frozik/cloud-storage

One file in the user's own cloud, read and written by the browser with no
server of ours in between. The library knows nothing about what the bytes
mean: it moves them, tells revisions apart and refuses a write that would
overwrite someone else's — or says honestly that the provider cannot refuse
it, so the caller has to make its format mergeable.

```
src/
  core/          IStorageProvider, capabilities, errors as values
  memory/        in-memory provider for tests
  indexeddb/     the device-local copy: real compare-and-swap in an IndexedDB transaction
  google-drive/  Drive v3, drive.file scope, revision-pinned reads, emulated compare-and-swap
  webdav/        any WebDAV server that allows CORS: ETag / If-Match, PUT .tmp + MOVE
  testing/       describeStorageProviderContract — one suite every provider passes
```

Only `core/` exists so far; the providers arrive with their phases of the
vault plan (`.claude/plan/2026-10-10-password-vault.md`).

## Contract

Every call takes an `AbortSignal` and returns a `TResult` (`@frozik/utils/result/result`)
— offline, `cors-blocked`, `quota` and `rate-limited` are values, not exceptions.
A write carries a precondition: `absent` (create), `match` (the revision the
caller read) or `overwrite` (an explicit user action only). Capabilities say
how strong the guarantee is: `conditionalWrite: 'atomic'` is a server-side
compare-and-swap, `'check-then-write'` narrows the race window and nothing
more. The full interface and the per-provider matrix live in
`.claude/plan/design/vault/sync.md` §8.

## Layers

`core/` imports nothing else in the package; a provider never imports
another provider; the package never imports `@frozik/vault`. All three are
enforced by `pnpm layers`.
