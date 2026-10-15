# Password Vault

A zero-knowledge password manager whose only storage is one encrypted file in the user's own cloud. Work in progress: you can try the demo vault or create your own, lock and unlock it, and browse its cards — sections, search, sort, a card's fields with show and copy — and create or edit cards.

Live: [https://frozik.github.io/portfolio/vault](https://frozik.github.io/portfolio/vault) · Part of the [portfolio](../../../../../README.md) monorepo; this folder is only its renderer and composition root (`presentation/Vault.tsx`). The core — crypto, the `.pwv` format, the card model, merge and sync — lives in [`libs/vault`](../../../../../libs/vault/README.md); the application models every vault client shares in [`libs/vault-app`](../../../../../libs/vault-app/README.md); the browser adapters in [`libs/vault-browser`](../../../../../libs/vault-browser/README.md); shared widgets in [`libs/vault-react`](../../../../../libs/vault-react/README.md).

## Addresses

Every page of a vault has its own address, so a link opens the same card after unlocking and the browser's back button walks the phone's screen stack:

| Address | Page |
|---|---|
| `/vault` | the vaults this device knows |
| `/vault/new` | a new vault's form |
| `/vault/open`, `/vault/open/new` | open a vault from a cloud; a new vault in the folder it reached |
| `/vault/:vaultId` | unlock, then all cards |
| `/vault/:vaultId/:section` | `all`, `favorites`, `expiring`, `expired`, `archive`, `trash` or a group |
| `/vault/:vaultId/:section/:cardId` | a card |
| `/vault/:vaultId/:section/:cardId/history` | its history |
| `/vault/:vaultId/settings`, `/vault/:vaultId/audit` | settings, audit |

The address is the only owner of the selection; `presentation/vault-paths.ts` builds and reads every one. Search text, titles and field values never enter an address — people paste passwords into search. An address the page does not know says so instead of redirecting. Cancel on a page reached from the one before it is the browser's Back, so the history holds no loop; a vault created or opened takes its form's place in the history.

## Creating and unlocking

- **Try the demo** — a local vault named Demo with made-up cards (accounts with one-time codes, a weak and a reused password, cards that are fine, expiring and expired, EU bank details, a protected and an archived card). Its password, `demo`, is shown on screen.
- **Create a vault** — a name and a master password: at least 12 characters, no rules about which. The strength meter (zxcvbn, in its own Worker, dictionaries loaded only here) warns about a weak password but never refuses it. Creating needs a ticked "there is no recovery" box.
- The key is derived with Argon2id in a Worker, calibrated on this device. The file is sealed there too; the browser stores only the sealed `.pwv`, one IndexedDB database per vault.
- The unlock field is `current-password` with the vault name as the username, so the browser's own password manager may remember the master password — that is the user's choice.
- **The demo is a demo.** The start screen says so and points to [Ciphra Vault](https://ciphra-vault.github.io/), the standalone app built from the same code.
- **Appearance** — system, light or dark, for the vault only: one icon in the vault's top corner that lays out all three on hover or tap (the rest of the portfolio stays dark); remembered on the device, and a browser that blocks site data says the choice will not be kept.

## Locking

The vault locks after 5 minutes without activity, after a minute in a background tab, after the computer sleeps, when the page is left and when it comes back from the back/forward cache. Locking reloads the page: a dying process is the only real way to wipe a key from JavaScript memory. The same address comes back locked. A copied secret is cleared from the clipboard after 30 seconds — after the reload if the tab had no focus. The lock button locks every tab of the vault; a tab that locks on its own (idle, hidden) leaves the others open.

**Quick unlock.** **Settings → Quick unlock** (after the master password) sets a PIN of 4–8 digits, a pattern on a 3×3 grid (the points exactly as the line went through them, a point may come back, at least four different ones; the line can be hidden) or the master password's first or last four characters, and how long it lasts (1, 4, 12 or 24 hours). An idle or background lock, and the lock button, then become a quick lock (as Bitwarden and 1Password lock): the key stays in memory behind the code mixed with a random secret that never leaves the tab, and the screen asks for the code. It gets **one** try: a wrong code locks fully and the master-password screen says why; so do the end of the lifetime, **Lock completely** on the code's screen and leaving the page. The pattern pad draws with a pointer or the keyboard (arrows, Space to join, Enter to finish). Unlocking with a quick code, a passkey or biometrics for a week brings a gentle reminder to type the master password — a dialog, never a lock.

**Passkeys** are labelled by the platform's own authenticator (Touch ID, Face ID, Windows Hello, …) and offered only where the browser supports the PRF extension.

## Browsing

Three panels: the sections (all cards, the smart groups that have members, archive, trash, then your groups), the list and the card. On a phone only the deepest panel shows and the back button walks up.

- **Search** — `Ctrl/⌘+K`; every word must match the title, a non-secret field or a site's domain, typed in either keyboard layout. Secrets are never searched, and the query never enters the address.
- **Sort** — by title (favourites on top), last change, creation or expiry.
- **Inside a vault** the site's top bar shows a back arrow on the left that returns to the list of vaults, as in Sudoku, Retro and Conference.
- **On a phone** the sections and groups hide behind the menu button in the vault's header and slide in from the left, as in SafeInCloud; picking one closes them. On a wide screen they stay in their column.
- **The list** renders only the rows in sight, so 5 000 cards scroll like 50. Arrows, Page Up/Down, Home/End move, Enter opens. A row shows the login or `•••• 1234`, never a secret, with badges for expiry and one-time codes.
- **A card** shows its fields; a secret stays masked until its eye icon ("Show"; each value of a list on its own, and it hides itself after 30 seconds, when the tab is hidden and when you leave the card), and the copy icon goes through the clipboard guard. Show, large type, copy, open and generate are icons with their names as tooltips, to save room. A protected card keeps its secrets shut.
- A test renders the demo vault and checks that no secret value reaches the page.
- **Icons.** A card with the automatic icon shows its network's logo when it has a card number (Visa, Mastercard, Mir, American Express and eight more; Troy, Naranja and Verve as a word), else its site's favicon, else its template's icon. A favicon is fetched once per site from icon.horse, falling back to favicone.com, scaled to a 64×64 PNG and kept inside the encrypted vault, so other devices show it without asking again. A site with no icon is asked again after 30 days. The demo ships its icons in the build. **Settings → Site icons** turns this off for the device. The editor's **Appearance** is a dropdown of about 90 built-in icons in nine groups (internet, finance, shopping, devices, security, documents, home, travel, health). A chosen icon replaces the favicon, and "Automatic" brings it back. Only a built-in icon takes the card's colour, so the colour dropdown appears only once one is chosen.

## Editing

- **New card** — the "+" beside the search (an icon, so it fits a phone); pick a template; the editor opens on its fields. **Edit** opens a card's copy: the vault changes only on **Save** (or `Ctrl+S`); **Cancel** asks before throwing changes away. The editor is not a `<form>`, so the browser neither offers to save a card's password as a site login nor fills one in.
- Every field kind has its control from the shared component library: masks for card numbers (grouped by network), IBAN and SWIFT, a month picker for "valid thru", the natural-language date picker for dates, password fields for secrets. A value that cannot be right blocks saving and says why; a failed checksum only warns.
- **Unsaved changes stand out.** In the editor a field added or changed since the saved version — and the title — gets a bar on the left and a tint (screen readers hear "changed, not saved yet"); on a new card, what is filled in. In the list, the card with unsaved changes — an open edit, or one a lock left waiting — is marked the same way, with "not saved".
- While a card is being edited, the other edits wait: "New card", "New group", "Smart group" and editing a smart group stay visible but disabled until **Save** or **Cancel**.
- "+ field" adds any kind as often as needed, "Files" included: each file field holds several files under its own label (a contract, passport scans, keys).
- **Passwords in turn.** For services that force a change and people who cycle through a few passwords, a password field can hold several: tick "Several passwords in turn" in the editor. They run newest first: the top one is in use, the next is the one before it, the last the oldest. The card shows the first two, each shown on its own; "Next password" in the editor brings the oldest back on top, saved with the card. The audit, the password's age, the export and the extension's fill all see only the one in use. Convenience over strictness, on purpose: the earlier passwords stay in the vault.
- A field's label is renamed from the pencil in its button group: Enter or leaving the field keeps the new name, Escape or a blank name brings the old one back. The label is the field's own name ("Scans"); its kind ("Files") is what "+ field" lists.
- Removing a field that holds a value asks first; an empty one goes at once. Either way the card changes only on **Save**.
- **Tabs.** In the editor the tab bar is always there (a card of one tab shows "Main"), and its "+" on the right adds a tab and opens it. With two or more, the open tab shows its name (blank reads as "Main"), ←/→ to move it among the others and "Delete tab". Deleting always asks; a tab with fields asks whether to move them to another tab or delete them with it. A field goes to another tab from the 📁 menu in its button group.
- Fields change places by their ⋮⋮ handle beside the remove button: drag it (mouse or touch), or with the keyboard press Space, move with the arrows and press Space again (`Esc` cancels); `Alt+↑/↓` on the handle moves a field one place at once.
- The edit in progress is sealed with its own key into the browser storage half a second after typing stops. Locked mid-edit, the vault offers it back after unlocking: continue or discard.
- Changed on another device while you edit: a banner says so. Saving over it opens a dialog listing what the other device changed, field by field (labels only, never secret values), with a choice for each part both of you changed — keep mine, take theirs, or combine.

## The card menu

Favourite, duplicate, add to or remove from a group (or a new one), protect, archive, move to the trash; from the trash, restore or delete forever — a deletion every device follows. A protected card keeps its secrets shut until the master password is typed again; it is checked by opening the vault file in the Worker, and protected cards then stay open for 5 minutes. Taking the protection off asks for the master password the same way, and bringing back an earlier version from the history never takes it off.

## History and the generator

- **Two versions at once**: when another device changed the same card before the two synced, both versions are kept and the card says so; the user keeps one, takes the other, or combines them — parts changed on only one side are taken from it, parts changed on both are the user's choice.
- **A one-time code** is shown live with a ring for the time left; it turns orange with 20 seconds to go and red under 10, and its copy icon sits at the right edge like every field's.
- **One-time codes from a QR code**: a screenshot, a pasted picture or a photo fills the field (the browser's own detector where there is one, jsQR elsewhere); a code on a transparent background or cropped tight to its edge is laid on white with a border first, and a QR holding only the secret is taken too; Google Authenticator's "Transfer accounts" QR is read too — in the editor the user picks the account, and in the import it becomes one card per account.
- **History** lists a card's earlier versions with when each was saved and how it differs from the card now — field labels, and on request each field then and now, secrets always hidden. Restoring is a new edit: the replaced version joins the history, so nothing is ever rewritten.
- **The generator** (next to a password field in the editor): random characters (8–128, with or without upper case, lower case, digits, symbols, look-alikes), words from the EFF large wordlist (3–12, with a separator, capitals, a digit) or a PIN, with the entropy of the method in bits. For a card whose site is in Apple's list of password rules (about 400 sites), it first offers a password those rules accept — length, required and allowed characters, the longest run of one character — parsed from the Password Rules language by our own parser, or says the rules leave no strong password. Nothing it makes is remembered.

## Settings

Per device: how soon the vault locks when idle (1, 5, 15 minutes or an hour) and when its tab is in the background (at once, 1 or 5 minutes, never), and how soon a copied secret is cleared (10, 30 or 60 seconds) — sealed with the vault's key, so they apply once it is unlocked. Per vault: its name and a description (an optional description can be given already when the vault is created; saved together, the later edit wins on every device; the start screen lists each vault with its description under the name, so both are kept in the open on the device, like the name, and the settings say to keep secrets out of it), the master password — changed with the current one and the new one twice; the key stays the same, every device takes the new password with its next sync (and says so), and a device that changed it offline is not taken for a rollback by a cloud that missed it; two devices that change the keys at once (say, a new password here, a recovery key there) end up with both — the recovery key: shown once, with an Emergency Kit PDF (the vault, where it is kept, the key as text and QR, a line to write the password by hand), turned on only after its last group is typed back; it opens the vault from the unlock screen when the password is forgotten (a typo is told apart from a wrong key) and then asks for a new password; a new key for the vault when the old one may have leaked — everything is sealed again (the cloud first, then this device's copy and its records), the recovery key has to be made again, and every other device asks for the master password once and switches over, keeping what it changed meanwhile; passkeys of this device (Touch ID, Windows Hello, a phone, a security key with the PRF extension) as a quick unlock — added after the master password, one per device, removed without any secret — and "delete from this device" — also on each vault's card in the start screen's list (the bin icon), without unlocking it, after a confirmation that says a cloud copy stays and a vault kept only here is gone for good. **Backups on this device**: earlier versions of the vault, sealed with its key like the local copy — kept before another device's changes come in, once an hour while editing and before a rollback; how many (5, 10, 30 or 100) is chosen per device, and the list shows when, why and how big. "Roll back" (after a confirmation) is one edit on top of now rather than a replaced file, so every device takes it with its next sync instead of merging it away: changed cards get the version they had then (the current one stays in each card's history, the protection stays as it is now), cards made since go to the trash, cards deleted for good since come back with their files; the vault as it was before the rollback is kept first, so a rollback can be undone. A backup sealed before a new key cannot be opened and says so. **A backup file** saves the vault file itself — the same vault under the same password, not a re-keyed export — through the save dialog; Ciphra Vault adds it back when it is dropped on its first screen. Large attachments kept beside the vault are not in it, and the panel says so. Credits for the word list, Apple's password-manager resources, zxcvbn-ts and hash-wasm.

## Import and export

Settings → Data. **Import** takes a file and tells what it is by its content: the password CSV of Chrome, Edge, Firefox or Safari, a SafeInCloud database (`.db`, opened with its password — the app's local database or a backup; its Google Drive copy sits in the app's hidden folder, which Google lets no other app read) or its XML export (fields one to one under their own names, labels as groups, star and colour; attachments are reported, not carried), a Bitwarden export (JSON or CSV), a file in the FIDO Alliance's Credential Exchange Format (CXF 1.0 — `cxf.json` alone or zipped with its files; logins, cards, Wi-Fi, passports and ID documents, SSH keys, one-time codes, custom fields, collections and tags as groups, item references as links; passkeys are reported), a KeePass database (`.kdbx` 3 or 4, opened with its master password in a Worker of its own that loads only then: groups and tags as groups, protected fields as secrets, KeePassXC's and KeePass's one-time codes, expiry, attachments; with its password, its key file or both) or another `.pwv`, which first asks for that vault's password. Every imported file's SHA-256 is computed from its bytes; one that disagrees with the hash its source declares stays out and is reported. A preview counts the entries by kind, lists what cannot come along, and — when some are already here (the same site and login) — asks whether to skip them, replace the cards (the old version stays in history) or keep both; nothing is written before "Import". An empty vault links here from its card list.

**Export** makes the file first and saves it on a second click, where the browser's save dialog may open: an encrypted copy (`.pwv`, or `.pwv.zip` with the big files beside it, still sealed) under a password of its own — a new key and a new id, so it can be handed over and never syncs with this vault — or, after the master password and a confirmation that the file is not encrypted, the open zip (the vault's JSON and each card's files by name), CXF for other password managers (a zip with `cxf.json` and the files, their SHA-256 computed from the bytes written; colour, icon, protection and archive travel in an extension of our own) or a CSV in Bitwarden's columns that most managers read.

**Smart groups of your own** come from a builder in the sidebar: a name, then cards that match every condition or any of them — favourite, a field of some kind, a template, a group or none, expiry, an audit finding, a possible duplicate, protected, archived, in the trash — each of which can be negated. They count like the built-in ones, in the same pass over the cards, and sync like groups.

Any card can become a **template of your own** from its menu: its tabs, field labels, kinds and secrecy, never its values. Own templates follow the built-in ones in the "new card" menu, sync like groups, and are renamed or deleted in the settings; deleting one leaves the cards made from it as they are.

## Audit

"Audit" in the header counts the cards with something to fix, and its page lists them by category, as 1Password's Watchtower does: found in breaches, weak (zxcvbn, in its Worker), reused on different sites (two domains of one site, by Apple's shared logins, are one), a plain-HTTP address, a site that offers one-time codes the card lacks (2FA Directory's list, fetched at most weekly), unchanged for a year by the card's history — or for the period a password field sets (every 30, 90, 180 or 365 days; the card then warns a week ahead and once overdue) — expired or expiring. The breach check is off until the user turns it on and sends only five hex digits of a SHA-1, padded. A password or address field can be left out of the audit in the editor. The sidebar gains "Problem passwords" and "Possible duplicates" (the same site and login).

## Cloud

A vault starts on this device and can be kept in the user's own cloud from the settings:

- **Google Drive**, in one of two places chosen per vault: a visible folder in My Drive — `Vault` unless another is typed, nested ones by slashes (`Documents/Passwords`); the file is always named after the vault (the user sees the file and can back it up; the site may touch only files and folders it created, so a same-named folder made by hand is not reused — a new one appears beside it) or the app's hidden folder (nothing in sight, gone when the user removes the site's access). Each asks only for its own non-sensitive permission; the sign-in popup opens from the click, a token lasts about an hour, and when it runs out the header offers "Sign in to Google".
- **A WebDAV folder** (Nextcloud, ownCloud, a NAS, rclone): "Service" picks a known one and fills the folder address from the login — Nextcloud, ownCloud and Seafile from your server's address too — or the address is typed by hand. Fifteen hosted services are listed (4shared, CloudMe, GMX, Koofr, MagentaCLOUD, Mail.Ru, Mailbox.org, MyDrive, pCloud EU and US, PowerFolder, Strato HiDrive, WEB.DE, wölkli, Yandex.Disk), their endpoints checked to answer WebDAV on 2026-10-12; none of them lets a web page in (no CORS), so for them the panel says to connect in the Chrome extension, which needs none. HTTPS address — plain HTTP only on this machine — login and app password; "Check" probes whether the server refuses a stale write itself (`If-Match`) or the vault must check first, whether a write lands in one `MOVE`, and whether it gives ETags. When the page cannot reach the server, the panel shows the CORS setup for Nextcloud, rclone, Apache, nginx and Caddy with this site's origin filled in. The app password and probe result are sealed with the vault's key on this device.

Connecting a cloud — in the settings and in "Open from a cloud" alike — is a three-step wizard: choose Google Drive or WebDAV, connect (sign in, or fill in and check the folder), then keep the vault there or pick one found there. Only the current step shows, the next opens once its condition is met (the sign-in found the folder, the check reached it), and "Back" returns one step keeping what was typed. "Keep this vault here" writes `<name>.pwv` there (or merges with the file already there) and from then on one tab per vault syncs it: edits go up once they pause for three seconds or when the tab is hidden, other devices' changes come down at unlock, when the tab is shown again, every five minutes and when the network returns. The header says whether it is synced, offline, waiting for Google or stopped; "↻ Sync" at the foot of the sections' column (in the sliding menu on a phone) syncs now: an edit still waiting goes up at once, otherwise the cloud's file is read and merged and anything this side has on top is written back — always with the conditional write, so a file that changed meanwhile is merged again, never overwritten, and a sync that stopped on a conflict stays stopped for the user's decision. "Disconnect the cloud" leaves the file where it is. Before the unlock this device shows only the vault's name: where it is kept — the cloud, the WebDAV address and login — and the app password are sealed with the vault's key, read once the local copy is open, and only then does the vault reach its cloud. On another device, "Open from a cloud" on the start screen signs in to Drive or checks the WebDAV folder, lists the vaults there, downloads the chosen one and asks for its master password; once unlocked it syncs with the same file. A reached folder with no vault in it offers "Create a new vault here": the usual form (name, description, master password), and the new vault is kept in that folder from the start — linked only to a vault the device did not know before, so a creation that never happened links nothing. A file at that address that belongs to another vault is never merged: sync stops and a dialog offers to replace it with this vault or to disconnect. The built page's CSP lists the hosts the page may call, so a WebDAV server must be one of them (an open question).

## A card at a glance

A bank card is drawn as the plastic (network, `•••• 1234`, holder, valid thru — nothing secret), a card that is about to or did expire says so in colour and words, an account with a site links to the page that changes its password there (Apple's list, else the site's `/.well-known/change-password`), linked cards (online banking and its cards) are one click away, and "Large" writes a secret out in big numbered cells to type it on another device.

## Guards

- No secret value reaches the page unasked: a test renders the demo vault and walks every text node and attribute; every secret field kind in the editor carries the attributes that keep other password managers, Grammarly and spell-check services away, and the class the bug reporter hides from captures; searching by a password finds nothing.
- The whole path runs in Playwright against the production build: try the demo, search, copy, edit, lock (the page reloads), unlock back on the same card; a deep link asks for the password first; leaving the page locks.
- Two browser profiles share one Google Drive in Playwright (Drive and Google's script answered by the test, the production CSP in force): the demo kept in Drive by one opens in the other with its cards. Before a cloud version changes the local copy, the copy is kept as a snapshot (the last ten).
- Cards stay in the trash for 30 days; the first unlock after that deletes them for good on every device.

## Files

A file field takes a pick, a drop, a paste or, on a phone, the camera. Photos are redrawn at most 2000 px on the long side as JPEG before they enter the vault; files up to 1 MiB ride inside the vault file (5 MiB in all, since every save re-encrypts it whole); a bigger one, up to 50 MiB, is sealed on its own under a key the vault keeps, written beside the vault on the device at once and to the cloud after the next sync, and read back only when a card shows it; an import seals its big files the same way, and a file no version names any more leaves the device at the next unlock and the cloud a month later. Key rotation leaves these files as they are — their keys move into the newly sealed vault — and the open archive export carries them, the sealed copy does not. Images show as thumbnails (a secret one blurred until shown), PDFs open in a tab of their own. A file nothing refers to any more is removed 30 days later. The demo passport carries a made-up scan.

## Chrome extension

[`apps/vault-extension`](../../../../vault-extension/README.md) is a second client of the same vault
file: it keeps its own copy (chosen from disk, or read from Google Drive or a WebDAV folder), unlocks it with the
master password, offers the page's cards and fills their login form on your click — each frame
checking its own address before it types. It only reads; its zip comes with every release of
Ciphra Vault, where its install steps live — the demo points only there.


## Running your own instance

The vault is a static page: there is no server holding data, every key is derived and every file
sealed in the browser, and the vault lives in your own cloud. What you have to trust is **the code
the page loads** — whoever controls the files served at the vault's address controls the vault.
The public build at `frozik.github.io` is a demonstration (the start screen says so) and shares its
origin with every other demo. For real passwords, build your own copy and serve it from an origin
of its own. The steps below assume a domain such as `vault.example.com`.

### What you need

- A domain or subdomain used **for this app only**. Pages on one origin share its storage and its
  service worker: never a shared `<user>.github.io`, which every Pages project of the account shares.
- A static host that serves HTTPS and lets you set response headers: Cloudflare Pages, Netlify,
  or your own nginx or Caddy. HTTPS is not optional — WebCrypto, the service worker, passkeys and
  the clipboard work only in a secure context.
- Node 24 and pnpm 11 to build.

### Build

1. Fork the repository, clone your fork, `pnpm install`.
2. Describe your deployment in `infra/hosts/mine.env` (no quotes):
   ```
   COMMUNICATION_DOMAIN=communication.invalid   # required by the build; a placeholder is fine without the conf/retro server
   GOOGLE_OAUTH_CLIENT_ID=unused                # required by the build; site sign-in, not the vault
   GOOGLE_VAULT_CLIENT_ID=<your client id>      # optional: Google Drive for the vault (below)
   ```
3. Remove what reports to third parties:
   - `apps/portfolio/src/app/bootstrap/cloudflareBeacon.ts` sends page views to the original
     author's Cloudflare analytics from any non-local host. Delete its call in `src/main.tsx`, and
     both `cloudflareinsights.com` entries in `vite-plugins/content-security-policy.ts`.
   - In the same policy, drop the hosts of demos you do not serve (Binance, map tiles, MediaPipe).
4. Have the installed app open the vault: set the manifest's `start_url` in
   `apps/portfolio/vite.config.ts` to `` `${BASE}/vault` ``. Everything is served under `BASE`
   (`/portfolio`); keep it, or change it there — the CSP and the Trusted Types policy follow it.
5. `DEPLOY_HOST_NAME=mine pnpm build`; the site is `apps/portfolio/dist`. Build from a tag of your
   fork and keep the commit next to the deployment, so what runs can always be rebuilt and compared.

### Serve it with real headers

The build puts its CSP in a `<meta>` tag because GitHub Pages sets no headers; a `<meta>` CSP
cannot stop the page being framed, and nothing but a header can turn on HSTS. Send these with every
response:

```
Content-Security-Policy: <the policy from dist/index.html's meta tag>; frame-ancestors 'none'
Strict-Transport-Security: max-age=63072000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Cross-Origin-Opener-Policy: same-origin-allow-popups
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

- The CSP carries hashes of the page's inline scripts, which change with each build: take it from
  the freshly built `dist/index.html` every time you deploy.
- `same-origin-allow-popups` rather than `same-origin`: Google's sign-in for Drive is a popup that
  must answer its opener.
- Serve `sw.js` with `Cache-Control: no-cache`. The service worker updates itself: a new
  deployment reaches every installed copy at its next start, so protect the deploy itself — two
  factors on the host account, a protected branch, deployments only from your own tags.

### Clouds

- **Google Drive.** In the Google Cloud console, create a project and enable the Google Drive API.
  On the OAuth consent screen choose External and add the scopes `drive.file` and `drive.appdata`;
  for yourself and your family, "Testing" with your accounts added as test users is enough. Under
  Credentials, create an OAuth client ID of type "Web application" with
  `https://vault.example.com` as an authorised JavaScript origin, and put its id into
  `GOOGLE_VAULT_CLIENT_ID`. `drive.file` lets the app see only the files it created, so a vault
  made with another client id stays invisible to yours.
- **WebDAV** (Nextcloud, a NAS…). Add your server's origin to `connect-src` in
  `vite-plugins/content-security-policy.ts`, then allow your vault's origin in the server's CORS
  settings — the connect form shows ready-made snippets for common servers.

### Install it

- **Desktop** — Chrome or Edge: the install icon in the address bar opens the vault in its own
  window. Safari on macOS 14+: File → Add to Dock. Firefox does not install web apps on most systems; a pinned tab works.
- **Android** — Chrome: menu → Install app.
- **iPhone and iPad** — Safari: Share → Add to Home Screen. Do install it there: Safari deletes a
  website's storage after seven days without use, which would take the local copy with it;
  apps on the Home Screen are exempt. Keep the vault in a cloud all the same.
- **Offline** the installed app opens from its cache and works with the local copy; changes go to
  the cloud once the network is back.
- **Passkeys** belong to a domain. A passkey made on one address does not open the vault on
  another: after moving to a new domain, unlock with the password and add the passkeys again.
  The vault file remembers each passkey's site, so a locked vault offers only the passkeys of
  the address it is opened on (and older ones whose site was never recorded).

### What it does not protect against

- While the vault is unlocked, anything with access to the browser process — DevTools, a
  debugger, malware — sees what the page sees. Locking reloads the page for that reason.
- Clipboard history managers see what you copy; the page cannot mark a copy as concealed.
- Screenshots and screen sharing cannot be blocked or detected by a web page.
- Guessing the master password is limited only by Argon2id's cost: a long passphrase is the
  protection, not the format.
- The code has had no independent security audit. You run your instance at your own risk.
