# Password Vault for Chrome

The browser extension of the [password vault](../portfolio/src/features/vault/README.md): it keeps its
own copy of a vault file, unlocks it with the master password, finds the cards for the page you are
on and fills their login form. It is a separate client of the same file — the vault's core
(`@frozik/vault`) and storage (`@frozik/cloud-storage`) are shared with the web app, nothing else is.

## Install

1. Download `password-vault-<version>-chrome.zip` from the latest
   [release](https://github.com/Frozik/portfolio/releases) and unpack it.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the
   unpacked folder.
3. Click the extension's icon. Choose the vault file (`.pwv`, exported from the web app), find it
   in Google Drive (the popup opens itself as a tab for Google's sign-in; choose the same place —
   a folder in My Drive or the app's hidden folder — the web app keeps the vault in), or connect
   the WebDAV folder it lives in (the server's address, username and an app password; Chrome asks
   once for access to that server, so no CORS setup is needed). "Service" fills the address for
   Nextcloud, ownCloud, Seafile and fifteen hosted services — pCloud, Yandex.Disk, GMX, WEB.DE,
   Koofr, MagentaCLOUD and more — which a web page cannot reach but the extension can.
4. Type the master password.

To stop Chrome's own password manager from offering itself next to the vault, turn it off in
`chrome://password-manager/settings`.

## What it does

- **The page's cards.** The popup shows the page's host (with its punycode next to a host in other
  letters) and the cards whose addresses match it, by each address field's own rule — the exact host
  unless the card says otherwise — and through Apple's list of shared logins (marked as such).
  Archived and trashed cards are never offered. No match: search the whole vault.
- **Fill.** One click fills login and password, or only the login on a login-first page, or the
  one-time code (one field, or one character per box). It types like a person — focus, the native
  value setter, `input` and `change`, key events, blur — so controlled inputs of React and Vue see it.
  A plain-HTTP page asks first; an HTTP frame in an HTTPS page is never filled; a sign-up or
  password-change form never gets the stored password in its "new password" fields. `Ctrl+Shift+L`
  (`⌘⇧L` on a Mac) fills the page's first card.
- **Copy.** Login, password, any field, or the current one-time code; the clipboard is cleared after
  30 seconds by the extension's offscreen page, though the popup has long closed.
- **Protected cards** ask for the master password again before their secrets leave the extension's
  background, and stay open for five minutes.
- **Sync.** A vault from Google Drive or a WebDAV folder is pulled when the popup opens and every
  15 minutes while unlocked. Google's token lives an hour and is renewed without a window for the
  account the vault was found with; when Google wants the user (signed out, access revoked) the
  popup says so and "Sign in" opens Google's window again. The extension only reads: a newer file replaces its copy; a file under another key (the
  vault was rotated elsewhere) locks it until the new key's password is typed.
- **Lock.** After five minutes without use, from the popup, and whenever Chrome restarts or the
  extension updates — the key lives only in `chrome.storage.session`. Locking reloads the extension,
  so nothing of the open vault stays in any of its pages.
- **Disconnect.** Under the master password, "Disconnect this vault…" asks once, then the extension
  forgets the vault: its copy, the sealed link to the cloud, Google's token and the setup; it locks
  and offers the setup again. The file in the cloud and the web app's copy are untouched.

- **Quick unlock by PIN.** Under the master password, Settings in the popup sets a PIN of 4–8
  digits. The idle lock and the lock button then keep the vault's key behind it for 12 hours,
  one try: the key is
  sealed with AES-GCM under a key derived from the PIN and a random pepper, both in
  `storage.session`; a wrong PIN, **Lock completely**, a restart or the end of the 12 hours
  leave only the master password. The PIN itself is stored sealed with the vault's key.
- **Reminder.** A week after the master password was last typed here, the popup asks for it —
  it never locks for it.
- **Theme.** System, light or dark for the popup, kept in the extension.
- **Updates.** The popup reads Ciphra Vault's `version.json`: a newer release is offered with a
  link to its download; a release below the security floor locks the vault and asks to install
  the new one (an unpacked extension never updates itself).

## Security model

- The vault key is unwrapped once with the master password and kept as raw bytes in
  `chrome.storage.session` (memory only, closed to content scripts); every time the background wakes
  it opens the copy again with it. Of the vault, `storage.local` keeps in the open only its name:
  where the file is (the WebDAV folder, login, file name and app password, or the Drive space, path
  and Google account) waits in `storage.session` (gone with a browser restart) until the first
  unlock, then is sealed under the vault's key. Google's token is kept only in `storage.session`. A pull that finds
  the vault re-keyed elsewhere keeps them in `storage.session` again, so the next unlock seals them
  under the new key.
- The background answers only the extension's own pages; nothing a web page says reaches it, and no
  content script runs on any site. Filling is injected on your click only (`activeTab`), in two
  steps: every frame first says where it is, with nothing secret sent; only the frames the card is
  for get the values, addressed by their document (a frame that navigated meanwhile is another
  document), and each checks its own address once more before it types. A field the browser does
  not draw with a size on the page is never filled.
- A copied secret waiting to be cleared is cleared before a lock (the lock reloads the extension,
  which would cancel the clearing). A protected card's five open minutes are kept beside the session
  key, so the background's sleep does not shorten them.
- No UI is drawn inside web pages (in-page suggestion menus are how password managers were
  clickjacked in 2025).

## Permissions, one by one

| Permission | Why |
|---|---|
| `storage`, `unlimitedStorage` | the session key (session storage), the setup and sealed records (local), the vault copy (IndexedDB) |
| `activeTab`, `scripting` | read the tab's address and inject the fill script, only after your click |
| `alarms` | the idle lock and the 15-minute pull outlive the background's sleep |
| `offscreen`, `clipboardWrite` | copy, and clear the clipboard after 30 seconds |
| `identity` | Google's sign-in window for Drive (`launchWebAuthFlow`) |
| `https://www.googleapis.com/*` | Google Drive |
| optional `https://*/*` | the one WebDAV server you connect, asked for when you connect it |
| optional `tabs` | reserved for a badge with the number of cards (not used yet) |

The background runs Argon2 as WebAssembly shipped in the package (`wasm-unsafe-eval` for extension
pages); there is no remote code.

## Not yet

- Passkey unlock, the badge with the number of matching cards, a settings page for the timeouts,
  and "create a card for this site" (which would open the web app).
- One-time codes of the HOTP kind: their counter belongs to the web app.

## Google Drive

The extension signs in with the web app's own OAuth client (`GOOGLE_VAULT_CLIENT_ID` from
`infra/hosts/<name>.env`, read at build time): `drive.file` lets an app see only the files its own
client made, so a client of its own would not find the web app's vault. Google sends the sign-in
back to `https://cinlldikjajnedgfcgnkoefcnnmmphbc.chromiumapp.org/`, which that client lists among
its authorized redirect URIs. The id is fixed by the public key in the manifest (`key` in
`wxt.config.ts`), so every install, unpacked or from the release zip, has the same one. The sign-in
runs in the background worker, because the popup closes as Google's window takes focus; that is
also why the setup moves to a tab.

## Development

```bash
pnpm --filter @frozik/vault-extension build      # .output/chrome-mv3, load it unpacked
pnpm --filter @frozik/vault-extension dev        # WXT dev mode with reload
pnpm --filter @frozik/vault-extension e2e        # Playwright against the e2e build (moon run vault-extension:e2e)
pnpm --filter @frozik/vault-extension fixture    # regenerate e2e/fixtures/e2e.pwv after a format change
```

The form detector (`src/domain/autofill`) is pure and tested on 18 HTML fixtures (Google's two
steps, GitHub, a bank without autocomplete, phone login, one-time codes in one field and in six
boxes, sign-up and password change, honeypots, shadow DOM open and closed, a page whose login is in a
frame). The e2e build grants the test domain up front because Playwright cannot click the toolbar
icon; the release build does not.
