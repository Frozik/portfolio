# @frozik/vite-plugins

Build plugins the web apps share (the portfolio and Ciphra Vault), run by Vite from their
TypeScript sources.

- `content-security-policy` — the page's CSP as the first `<meta>` in `<head>`, after the
  charset. The app supplies its directives as a function of the hashes of every inline script
  and style on the built page; the plugin adds a `default` Trusted Types policy that lets
  script URLs through only from the site's own assets and service worker, `blob:` URLs and a
  listed set of services.
- `app-version` — the version a build is stamped with: a variable CI sets, else `git describe`.
- `host-file` — reads `infra/hosts/<name>.env` (`DEPLOY_HOST_NAME`, `production` by default),
  so OAuth client ids and addresses have one owner.
- `kdbx-without-node-crypto` — kdbxweb bundled for the browser without Node's `crypto`.
