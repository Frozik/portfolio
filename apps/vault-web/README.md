# Ciphra Vault — the web app

The password vault as an installable web app for phones and desktops, hosted at
[ciphra-vault.github.io](https://ciphra-vault.github.io/). It renders the same application
layer as the portfolio's vault demo ([`libs/vault-app`](../../libs/vault-app/README.md)) with
its own mobile-first screens, and keeps nothing but sealed `.pwv` files on the device.

Everything the portfolio's vault does, on a phone-first layout: first run, unlock (password,
passkey, recovery key, quick code), reading and editing cards, history, audit, import and
export, every setting.

## Screens

- **First run** — the vaults this device knows (names and descriptions only), **Open from a
  cloud** (Google Drive or a WebDAV folder; the vault found there is copied to this device) and
  **Create a vault** (on this device, or in the folder the opening reached), **Open a vault
  file** — or drop a `.pwv` anywhere on the screen: the vault joins this device and its unlock
  opens; a vault it already knows just opens.
- **Unlock** — **All vaults** leads back to the list; the master password (the browser may remember it under the vault's name), a
  passkey of this device, or the Emergency Kit's recovery key; a quick lock asks for its PIN,
  pattern or four characters first, once.
- **Theme** — one icon in the top corner (system, light or dark); hovering or tapping it lays
  out all three. In an open vault it sits in the header, next to the lock.
- **An open vault** — the cloud's state, the theme and the lock button on top (behind the quick code once one is set up; **Lock completely** on the code's screen leaves only the master password); the bottom tabs **Vault**,
  **Search**, **Audit** and **Settings** (on touch the search field waits for that tab; with a mouse it is focused at
  once); the sections and groups in a sheet; favourites in a strip above the list; a virtual
  list, so thousands of cards scroll smoothly.
- **A wide screen** (from 1024 px) — the first screen splits in two: what the app is on the left,
  the vaults in two columns and the ways to get one on the right. An open vault shows the
  sections, the list and the open card side by side, as in
  the portfolio's demo; **Vault**, **Audit** and **Settings** move to the header, the search stays
  in sight. Below that the sections slide in from the left.
- **A card** — full screen: secrets masked until shown, large type, copy at the point of
  action (the icon turns into a check, a snackbar says what was copied and counts down to the
  clearing, with **Clear now**), live one-time codes, protected cards opened by the master
  password.
- **Editing** — "+" starts a card from a template; **Edit** opens the editor full screen; the
  vault changes only on **Save**; an edit a lock left waiting is offered back. **History**
  lists a card's earlier versions with what changed.
- **Audit** — weak, reused and old passwords, expiring cards, sites with two-factor available;
  the breach check is opt-in.
- **Settings** — lock timeouts and the clipboard, quick unlock, the vault's name and
  description, the master password, the recovery key and its Emergency Kit, passkeys, a new
  key, where the vault is kept, backups on this device and a **backup file** (the vault file
  itself, saved through the save dialog wherever the user keeps backups; it opens with the same
  password and, dropped on any device's first screen, brings this vault back), templates, import (KeePass, Bitwarden,
  SafeInCloud, CSV, CXF) and export, removing the vault from this device, about.
- **Empty and failing states** — an empty vault offers an import, a search that finds nothing
  offers the archive, a missing local copy points to the cloud.
- **Privacy curtain** — while the app is out of sight a brand screen covers it, so the app
  switcher's picture shows nothing.
- The weekly master-password reminder is a sheet that asks and never locks.

## The page

- **Content Security Policy** as a `<meta>` (GitHub Pages sends no headers), built by
  [`@frozik/vite-plugins`](../../libs/vite-plugins/README.md): no `'unsafe-inline'` for scripts
  or styles — every inline script and style is allowed by its hash; no analytics beacon;
  `connect-src` lists Google Drive, the breach range API, the 2FA list and the icon services by
  path; Trusted Types are enforced. An end-to-end test reads the built page and checks every
  inline hash is in the policy.
- **Not framed.** A `<meta>` CSP cannot carry `frame-ancestors`, so the page starts hidden and a
  hashed script shows it only at the top of its window; a page whose scripts are blocked stays
  hidden.
- **No flash.** The same script sets `lang` from the browser's languages, `data-theme` from the
  stored choice (system, light or dark) and points the browser chrome's `theme-color` at it,
  before the first paint.
- **Deep links** on Pages: the build writes `404.html` as a copy of the page.

## Offline and updates

- The service worker precaches the whole build at install, so the app opens offline after one
  visit; its caches carry the `ciphra-vault` prefix.
- **A new build never replaces the code under an open vault.** It installs and waits; the page
  lets it take over only when it holds no key — at launch or behind a full lock — and then
  reloads into it. A quick lock is never turned into a full one by a deploy.
- **Security floor.** Each release publishes `/version.json`
  (`{web: {latest, minimum}, …}`), read past every cache at launch, every 10 minutes and when
  the app comes back into view. A build below `minimum` locks the vault fully, asks for the new
  worker at once and says why; a newer `latest` is only offered. Offline, or with a file that
  cannot be read, nothing is blocked.
- **Kill switch.** `moon run vault-web:build-kill-switch` builds an emergency `sw.js`
  (`dist-kill-switch/`) that, deployed in place of the app's worker, deletes every cache,
  unregisters itself and reloads the open windows from the network.

## On an iPhone

The web app is the iPhone product (there is no App Store app):

- **Install first.** In a Safari tab the first screen asks to add the app to the Home Screen
  (Share → Add to Home Screen): Safari erases a site's data after a week without a visit, and
  the Home Screen app keeps its data apart from Safari. Open the vault from the cloud inside
  the installed app.
- **Face ID / Touch ID** through a passkey with the PRF extension (iCloud Keychain, iOS 18+);
  the master password always works.
- **Export** and the Emergency Kit go through the share sheet (Files, a cloud, AirDrop).
- **Sheets** lift above the on-screen keyboard.
- Limits: the clipboard is cleared only while the app is in front; Universal Clipboard may
  pass a copy to a Mac; no system autofill; the vault locks when the app leaves the screen.

## Performance

The start and the unlock screen load first; the open vault's model and every other screen load
after the unlock. Initial JavaScript is about 260 KB gzipped (budget 300 KB); Lighthouse holds
performance at 0.9 or more and accessibility, best practices and SEO at 1, in the light and the
dark scheme (`moon run vault-web:lighthouse`). Every screen reflows into 320 CSS px (an e2e
check), which is also 200 % zoom on a 640 px window.

## Releases

Ciphra Vault is published from the organization repository `ciphra-vault/ciphra-vault.github.io`,
whose only workflow calls this monorepo's `.github/workflows/vault-release.yml` at a pinned
commit; the files that repository holds live in `org-repo/` here. Dependabot raises the pin on
every monorepo tag, and merging that pull request is the release. The workflow skips a tag that
touches none of the vault's projects; otherwise it builds the web app and the extension stamped
with the tag, writes `version.json` (`node libs/tooling/src/write-release-manifest.ts`, the
floor from `release-floor.json` — raise it by hand for a security fix; a floor above the release
fails it), attaches the zip, `SHA256SUMS` and CycloneDX SBOMs with a build-provenance
attestation, and deploys the site. The privacy page is `public/privacy.html`.

## Build

```bash
pnpm --filter @frozik/vault-web serve     # dev server
moon run vault-web:build                   # dist/
moon run vault-web:e2e                     # Playwright against vite preview
```

The vault's Google OAuth client id comes from `infra/hosts/<name>.env`
(`GOOGLE_VAULT_CLIENT_ID`); without one the app offers no Google Drive. `VAULT_WEB_VERSION`
stamps the release version; locally it is `git describe`.
