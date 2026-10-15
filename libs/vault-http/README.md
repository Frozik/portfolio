# @frozik/vault-http

The password vault's adapters that need nothing but `fetch`, so the browser and the phone
share them: connecting a cloud folder (WebDAV, and Google Drive through the platform's own
sign-in), probing a WebDAV server for vaults, the Have I Been Pwned range check, the
published `version.json` and site icons (the services and their fallbacks; each platform makes
the PNG with its own pictures). Each implements a port of `@frozik/vault-app`; a composition
root wires them. Anything that needs the DOM, a Worker or browser storage stays in
`@frozik/vault-browser`.
