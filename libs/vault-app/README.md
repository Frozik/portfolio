# @frozik/vault-app

The password vault's application layer: one set of MobX models that every client
renders — the portfolio's vault, the Ciphra Vault web app, the Chrome extension's popup and
the Android app. A client is a renderer plus a composition root; the logic lives here and
in the core (`@frozik/vault`).

No React, DOM or React Native: the package runs in Node in its tests, globals such as
`window`, `navigator` or `chrome` are banned by oxlint, and the outside world comes in
through ports each client implements.

## Contexts

| Context | Owns |
|---|---|
| `document/` | the open vault's cards: view, editing, drafts, files, site icons |
| `keys/` | credentials: master password, passkeys, recovery key, quick unlock, the reminder |
| `session/` | the lock lifecycle, lock policy, key custody; the composition point of the others |
| `exposure/` | what leaves the vault on screen: protected cards, reveal, clipboard, screen capture |
| `sync/` | the local copy, the cloud replica, backups |
| `cloud/` | the link to the user's cloud and the forms that make it |
| `interchange/` | import and export |
| `audit/` | weak, reused and breached passwords |
| `device/` | per-device settings that need no key: the vault list, the theme |
| `release/` | update checks against the published version manifest |

`navigation/` is the shared page model the renderers map to their own routes; `texts/` holds
the translation tables and the functions that turn a model's state into words.

Each context has `domain/` (pure, framework-free, its ports under `domain/ports/`) and
`application/` (MobX models). Dependency rules (`pnpm layers`, tested in
`libs/tooling/src/vault-dependency-rules.test.ts`): a domain sees only its own context, the
core and `@frozik/utils`; an application model may read other contexts' domain, and only
`session/application` uses other contexts' models; models never import `texts/` or an
adapter; renderers read models, navigation and texts, and only types from the core.
