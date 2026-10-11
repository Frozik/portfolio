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
  webdav/        any WebDAV server that allows CORS: ETag / If-Match, PUT .tmp + MOVE;
                 webdav-presets — the folder addresses of known services and self-hosted servers
  testing/       describeStorageProviderContract — one suite every provider passes
```

`core/with-retry.ts` wraps any provider: `rate-limited`, 5xx and `offline` are
retried with exponential backoff and full jitter (`Retry-After` wins), four
attempts in all.

## WebDAV

`probeWebDav` runs once when an account is connected and returns what the
server honours (`IWebDavFeatures`); `createWebDavProvider` then picks its
strategy from that:

| The server | Write | Capability |
|---|---|---|
| answers a wrong `If-Match` / `If-None-Match: *` with 412 (Nextcloud, Apache) | one conditional `PUT` — the server compares and swaps | `atomic`, reads pinned with `If-Match` |
| ignores them (rclone, nginx), `MOVE` honours `Overwrite` | PROPFIND first, bytes to `.<name>.<uuid>.tmp`, `MOVE` in place; a create is `Overwrite: F`, still the server's own check | `check-then-write` |
| neither | PROPFIND first, plain `PUT` | `check-then-write` |

A browser refuses a request whose headers the CORS preflight does not list,
so a server that does not allow `If-Match` counts as one that ignores it.
Revisions are the ETag, or the modification time with the size where there
is none (one-second resolution, said by `revisionKind: 'last-modified'`); a
server with neither is refused by the probe. A PUT into a missing folder
creates the folders (`MKCOL`); temporary files a cut-short write left behind
are removed a day later by the next write and never listed. The ETag of a
`PUT` is used when CORS exposes it, so another writer slipping in before the
stat cannot hand its revision to this one.

`src/webdav/fake-webdav-server.test-helper.ts` is a `fetch` fake with the
variations above; the contract runs over each. `pnpm webdav-contract` runs it
against `rclone serve webdav` in Docker (an informational CI job does the same).

## Contract

Every call takes an `AbortSignal` and returns a `TResult` (`@frozik/utils/result/result`)
— offline, `cors-blocked`, `quota` and `rate-limited` are values, not exceptions.
A write carries a precondition: `absent` (create), `match` (the revision the
caller read) or `overwrite` (an explicit user action only). Capabilities say
how strong the guarantee is: `conditionalWrite: 'atomic'` is a server-side
compare-and-swap, `'check-then-write'` narrows the race window and nothing
more.

## Layers

`core/` imports nothing else in the package; a provider never imports
another provider; the package never imports `@frozik/vault`. All three are
enforced by `pnpm layers`.
