# Ciphra Vault — the Android app

The password vault as an Android app. It renders the same application layer as the web app
and the portfolio's demo ([`libs/vault-app`](../../libs/vault-app/README.md)) with native
screens, and keeps only sealed `.pwv` files and sealed device records on the phone.

Built with Expo SDK 57 (React Native 0.86, the New Architecture, Hermes) and Expo Router.
There are no over-the-air updates: every change ships as a signed APK the user can verify.

## Screens

- **First run** — the vaults this phone knows (names and descriptions only), **Open from a
  cloud** (one list of storages — Google Drive's hidden app folder or a folder in My Drive,
  with a Google account already on the phone; each known WebDAV service: Yandex.Disk, pCloud,
  Koofr, Nextcloud…; another WebDAV server — the choice opens only that storage's fields;
  a phone needs no CORS), **Open a vault file** (any `.pwv` from Files, Drive or a USB stick),
  **Create a vault** (on this phone, or in the folder the opening reached) — three equal icon
  buttons in a row; a vault this phone opens with the fingerprint shows one before its name; the
  gear in the corner slides up the theme. A file
  another app hands over — "Open with" from Files, "Share" from a messenger or the mail — is
  taken in the same way as one picked here: a `.pwv` opens at its vault's unlock; anything else
  (a SafeInCloud `.db`, a KeePass file, another manager's export) first asks where it goes
  (`/import`: every vault on the phone, the open one marked, and **New vault**). A picked vault
  opens — after its unlock when it is locked, the open one being locked first when another is
  picked — and only that vault's import takes the file; a new vault's import opens as soon as it
  is made. **Do not import** forgets the file. The import asks the
  source's password (a SafeInCloud database's in either of the two encodings its header may name) (`modules/vault-files` reads the intent once, so a lock's reload does not
  open it again; Expo Router is told to ignore the file's link). Any
  master password will do, even one character: the strength line under it turns red for a very
  weak one and yellow for a weak or fair one, warns that whoever gets the file and guesses the
  password reads every password inside, and suggests what is missing — length, digits,
  capitals, symbols.
- **Unlock** — the master password, the recovery key (its button held to the screen's bottom, and
  shown only when the vault's header holds a recovery slot), the fingerprint (a button beside
  «Unlock»; only a strong,
  Class 3 sensor; the phone's class is shown; once it holds the vault, the unlock screen asks for
  it at once by itself, the keyboard staying down, and after a cancel its button asks again), or a quick lock's PIN, pattern or four
  characters, once. As in Bitwarden, the quick code survives Android ending the app: the key is
  kept behind it in the Keystore (read once with the master password), until a wrong code, the
  end of its lifetime, **Lock completely** or "Ask for the master password after the app
  restarts". A key rotation or a new fingerprint turns biometric unlock off and says so.
  **All vaults** leads back to the list from every unlock and waiting state; a lock (which
  restarts the JavaScript runtime) comes back to that vault's unlock, not the first screen.
- **An open vault** — one row on top: the vault's first letter (a red dot when the cloud is in
  trouble; pressed, a sheet of the phone's vaults with the open one marked and its cloud state —
  picking another locks this one and goes to that one's unlock — and **All vaults**, where the
  list marks the vault that is open), then the page's own tools or the vault's name, and the lock
  (behind the quick code once one is set up, as Bitwarden locks; a long press locks completely); strips for a key changed on another device (the password follows it),
  a vault opened with the recovery key, keys changed elsewhere, and the biometric offer; the bottom tabs **Vault** (on the
  list it turns into **Sections**, ☰, and opens the sections sheet; from another tab it only comes
  back to the list), **Audit** (with its count of cards that need attention) and **Settings**; the sheet — also behind the section's name on top — lists sections and labels in two blocks with a mark each — **Sections** (all, favourites, recent, bank cards, notes, one-time codes, no label, protected, archive, trash) and **Labels** (a label in its colour); the labels are renamed, recoloured, added and deleted under Settings → Labels, and a label swiped left in the sheet opens the same editor; on the list the top row holds
  the section, the search and sort buttons and **+**; the search and the sort chips stay out of
  sight until their buttons show them (below 400 dp of width one button shows both; a button
  stays pressed while its row is shown; putting the search away drops the query, the sort stays); the cards
  opened lately and the favourites in strips above a `FlashList`, each with the web's icon (a
  card number's network logo — the web's set, `react-svg-credit-card-payment-icons/native` over
  `react-native-svg` — or the site's icon, both on the card's colour when one is chosen; the chosen
  Lucide icon in the card's colour; or the template's). The list reuses its rows, as `FlashList`
  is meant to: a row given another card snaps its swipe and its slide shut instead of being built
  again, a swipe's actions are drawn only once it starts, and rows are drawn 1000 dp ahead. A row's ⋯ (or a long press) slides the whole row left, the ⋯ with it, onto the icons
  that lie behind its end (half a second, eased): copy what the card's kind has worth pasting —
  an account's login, password and one-time code, a bank card's number, holder, expiry and PIN, a
  bank account's IBAN, BIC and holder, a document's number and expiry, a server's host, login and
  password, a Wi-Fi's name and password — star it, protect it (protection comes
  off only in the card); the ⋯ again slides it back, one row is open at a time, and an open row does not swipe; a row swiped right uncovers the trash, swiped left the archive;
  in the archive left takes the card out of it, right
  to the trash; in the trash right deletes it for good, left restores it; an empty vault offers a first card or an import.
- **A card** — one row on top: the back arrow, the icon, the title (cut with an ellipsis), its
  marks, and Edit and History as icons; secrets masked until shown, large type, copy with a haptic tick and a snackbar
  that counts down to the clearing, open a site, its files by name and size with two actions —
  save into a folder picked in the system's picker (Downloads, a cloud's folder) and view: a
  picture or a text in a sheet here, anything else in an app that opens it (a paper clip marks such
  a card in the list), live TOTP / Steam codes (a ring empties with the time left; the code and the ring turn orange
  from 20 seconds and red from 10) and HOTP with "Next
  code", the bank-card face, expiry and password-age banners, linked cards, protected cards
  behind the master password, history (one row: the back arrow and the title, cut with an ellipsis) with Restore and Delete
  under each version.
- **A one-time code from its QR** — two buttons under a TOTP field. The camera (`expo-camera`'s
  ML Kit scanner over the whole screen) fills the field at the first QR with a code; a QR of
  anything else is pointed out and the camera keeps looking. The permission is asked at first
  use, and once refused for good the phone's settings are offered; no microphone permission is
  declared. A screenshot is read by the same ML Kit, the picture kept in the cache only while it
  is read. A Google Authenticator transfer of several accounts asks which one this card is for.
- **Editing** — the icon (automatic or one of the built-in ones, by group) and its colour (a
  built-in icon is drawn in it, an automatic one sits on it),
  protection (also from a row's long-press menu, where taking it off asks for the master password),
  every field kind (its name once, above the control and inside it while empty), a field's
  actions as icons beside its name — rename, up, down, to another tab, remove — waiting behind ⋯ when the
  name leaves them no room (the ⋯ slides the name aside onto them, like a list row's), tabs (each with a pencil that renames, moves or deletes it), the generator (the site's
  password rules first), attachments, a one-time code from its QR through the camera or from a screenshot (above),
  the conflict dialog when another device saved the card. An edit a lock left unsaved waits
  in a one-line notice on the list (✎ takes it up, 🗑 throws it away), and its card opens
  straight in the editor. A tab's dialog is one row: ‹ › to move it, Delete and Save; a tab with
  fields asks before they go with it.
- **Audit** — a group per finding, each with its mark, a red count and its cards (a card opens
  from there; a password problem links to the site's change page): leaked (the breach check is
  opt-in), weak, reused, insecure address, two-factor available, old, expired, expiring, and
  possible duplicates.
- **Settings** — as Android lays them out: a list of topics, each with its mark and a line of
  what is inside, falling into a page of its own (the arrow or the system back returns):
  **Security** — lock timeouts and the clipboard, site icons, quick unlock, biometrics (with no fingerprint on the
  phone, a button opens Android's enrolment and the sensor is read again on coming back),
  screenshots; **Display** — the theme and what the screens show (the list's strips of cards opened lately and favourites, the
  Audit tab's red count of cards that need attention, hidden at zero; each on until turned off on
  this phone); **Labels**; **This vault** — its name, the master password, the recovery key with a
  text Emergency Kit, a new key, removing it from the phone; **Cloud** — the same list of storages, then the fields of the
  chosen one; **Import and export** — import (CSV, Bitwarden, SafeInCloud, CXF, KeePass, another
  `.pwv`) and export through the share sheet (`.pwv`, open zip, CXF, Bitwarden CSV, a SafeInCloud
  database `.db` sealed with a password of its own, or SafeInCloud XML); **Backup** — copies of
  the vault file itself (the same vault under the same password, attachments kept beside it
  excepted) in `Android/data/io.github.ciphravault.vault/backup`, where a computer over USB
  finds them; one is made when the vault opens once the chosen interval has passed (never, 2, 7
  by default, 14 or 28 days), or at once with **Make a copy now**; the location field opens the
  folder's copies, newest first, each shared through the share sheet or deleted. The folder goes
  with the app when it is uninstalled, so a copy meant to last is shared elsewhere; **Diagnostics** — what
  the app did (opening, unlocks and their failures, locks and why, the cloud sync's reads, writes
  and errors, Google sign-in with Google's status code), in a database file of its own; only codes,
  kinds and counts are written — never a vault's name, a card, an address, an account or anything
  typed. Shown newest first through a filter (everything, only problems, or one kind), kept for 1,
  7 (by default) or 30 days and never more than 5,000 entries, and copied as it is filtered, headed
  by the build, Android and the phone's model; **About** — the version, the author with a link to the author’s homepage, the credits. An empty vault's
  import button lands on Import and export.
- **Everywhere** — every dialog closes with its X, a tap outside or back; forms give way to
  the keyboard (edge to edge, Android no longer resizes the window); a secret field can be
  shown while typing and hides itself again; back steps through the cloud wizard instead of
  leaving it; a pattern the system interrupts is dropped, never sent as the one quick try.
- **Updates** — the first screen's title carries the running version in a badge and, when a newer
  release is out, a small update button at its right edge (a local build, which names no release,
  is never offered one); below the published security floor the
  app locks and only says where to get the new APK.

## Install

1. On the phone, open the latest release:
   <https://github.com/ciphra-vault/ciphra-vault.github.io/releases/latest>.
2. Download `ciphra-vault-<version>.apk`.
3. Open it; Android asks to allow installs from the browser once — allow it for this install.
4. Optional but recommended: verify the file before opening it (below).
5. A later release installs over the earlier one, keeping the vaults: the same signing key and
   a higher `versionCode` (`major·10⁶ + minor·10³ + patch`).

## Verify a download

- **Checksum:** `sha256sum ciphra-vault-<version>.apk` matches the line in the release's
  `SHA256SUMS`.
- **Provenance:** `gh attestation verify ciphra-vault-<version>.apk -R
  ciphra-vault/ciphra-vault.github.io --signer-workflow
  Frozik/portfolio/.github/workflows/vault-release.yml` — the file was built by that workflow
  at the commit the release pins.
- **Signature:** `apksigner verify --print-certs ciphra-vault-<version>.apk` prints the
  certificate SHA-256 digest
  `b2a0b977dfc8355d16147e938fac7e1154a4ed1f040445bc34b83d4df1e10b0b` (keytool shows it as
  `B2:A0:B9:77:DF:C8:35:5D:16:14:7E:93:8F:AC:7E:11:54:A4:ED:1F:04:04:45:BC:34:B8:3D:4D:F1:E1:0B:0B`).

## Security model

- The vault file is the same `.pwv` as everywhere: Argon2id (64 MiB, calibrated on the
  phone) derives the key-encryption key; the data key is AES-256-GCM, opened only in the app.
  Argon2 and the ciphers are OpenSSL through `react-native-quick-crypto`; a thin shim makes
  its failures read as WebCrypto's (`OperationError`), and the WebCrypto contract suite runs
  against it.
- On the phone: one SQLite file holds the device stores (registry, sync state, sealed drafts,
  settings and the cards opened lately — sealed under subkeys of the vault's key) and each
  vault's local copy. `allowBackup` is off: the vault leaves the phone only through the user's
  own cloud or an export.
- Google Drive signs in through Android's own account picker and consent screen (Identity
  `AuthorizationClient`, the shared `libs/expo-google-authorization`, as Calls Filter does):
  no password and no client id in the app — Google knows the app by its package and the
  SHA-1 of its signing certificate, registered as an Android OAuth client. The account chosen
  last (kept in `expo-secure-store`) is the one every Drive vault on the phone syncs through;
  an expired sign-in shows «Sign in to Google» in Settings → Cloud.
- Biometric unlock keeps the vault's key in the Android Keystore behind `BiometricPrompt`
  (`expo-secure-store` with `requireAuthentication`); turning it on asks for the master
  password once more, because an open vault's key cannot be read out.
- Screenshots, screen recording and the app-switcher picture are blocked (`FLAG_SECURE`);
  a setting allows them for an open vault after a confirmation, never on the unlock screens.
  `MainActivity` sets the flag before its first frame (a config plugin in `app.config.ts`) and
  JavaScript only lifts it for an open vault that allows it: set from JavaScript alone, it came
  too late on a cold start and was never set at all, so every screen could be captured.
- No WebView, no analytics, no custom URL scheme, HTTPS only. Site icons come from icon.horse or
  favicone.com, else from the site's own page (its home-screen icon, then its largest one — a page
  in a browser cannot read another site, an app can), else Google's favicon service; each domain
  once (a site the browser's narrower search found without an icon is asked again at once), and they can be turned off in the settings. In the dark theme a site's icon sits on a light
  tile, as sites draw their icons for a light browser tab.

### Weaker spots, said plainly

- **Memory.** A lock replaces the JavaScript runtime (`reloadAppAsync`): the old heap is
  freed, not zeroed. Strings — a typed password, a copied secret — cannot be wiped in
  JavaScript at all. The reload waits for the database's queued statements first and lets no
  new one through: SQLite's native connection outlives the runtime, and a transaction cut in
  half left the database locked, so the next unlock failed.
- **Biometric secret on the bridge.** `expo-secure-store` takes strings, so the key crosses
  to the Keystore as base64 once per enrolment and once per biometric unlock.
- **Rooted phones.** A rooted or compromised phone can read the app's memory while a vault is
  open; the app does not try to detect root.
- **The clipboard.** A copied secret is cleared after the chosen time; keyboards and clipboard
  managers with their own history keep what they saw.

### Backups

Keep the vault in a cloud folder, export an encrypted `.pwv` now and then, and print or write
down the Emergency Kit's recovery key. Without the master password and the recovery key no
one — this app included — can open the vault.

## Icon

A chest in the vault's palette, the same on the phone, the PWA and the extension. The sources are
`assets/icon.svg` (full bleed, the launcher masks it) and `assets/adaptive-icon.svg` (the chest in
the adaptive icon's safe zone over `#0f1320`); the PNGs are rendered with ImageMagick:

```bash
magick -background none -density 1200 assets/icon.svg -resize 1024x1024 assets/icon.png
magick -background none -density 1200 assets/adaptive-icon.svg -resize 1024x1024 assets/adaptive-icon.png
```

## Development

```bash
pnpm --filter @frozik/vault-native test      # jest-expo + RNTL, over the real models on a fake device
pnpm --filter @frozik/vault-native types
moon run vault-native:bundle-check            # expo export: the Hermes bundle builds
moon run vault-native:start                   # Metro for a development build
moon run vault-native:run-android             # a development build on a connected phone
moon run vault-native:build-apk               # a release-shaped APK (prebuild's debug signature)
pnpm vault-android:e2e                        # the e2e tests in e2e/ on the running emulator / phone
pnpm vault-android:dev                        # the app as it is now on the emulator, open on the test vault
```

`pnpm vault-android:dev` (`dev-android.sh`, `--no-build` to reinstall the last APK) is what to
look at after a change: the release APK for the emulator's ABI installed over the one there, then
the test vault unlocked by the e2e agent. The vault (`dev/test-vault.mts`, master password
`test-vault-1234`) holds ten cards of eight templates in four groups, with a one-time code, two
protected cards and what the audit must find: a weak password, a reused one, one older than a
year and a passport about to expire. On a phone that does not know it yet, the script seals it
anew, pushes it to Downloads and opens it through Android's file chooser.

`pnpm vault-android:e2e` (`e2e-android.sh`) is the `native-e2e` CI job run locally: it builds the
release APK for the connected device's ABI only, installs it and runs `node --test` over
`e2e/*.e2e.mts` on a 320x640 dp screen (the smallest phone, as on the CI emulator; restored
afterwards); CI calls the same script with `--prebuilt`. Only what a phone alone shows is tested
there — the window kept from screenshots from the first frame of a cold start (read from the
window manager over `adb`), and a vault created, locked and opened again with Argon2 and the
keystore for real; every screen's logic is a Jest test. The test drives the screen through the shared e2e agent
(taps by `testID`, text set at once); each test is bounded as a hang guard and a failure leaves the screen, the view
tree and logcat in `e2e-artifacts/`, which CI uploads. The run takes about
12 s on a Mac; the approach is described once for both Android apps in
[`libs/tooling/src/android-e2e`](../../libs/tooling/src/android-e2e/README.md). It needs a booted emulator (`emulator -avd <name>`). `libs/tooling/scripts/android/install-ndk.sh` installs the NDK
react-native asks for before Gradle does: Gradle's own single download sometimes arrives cut short.
On CI and in the release, `libs/tooling/scripts/android/ccache-env.sh` routes the native modules' C/C++ compiles through
ccache (CMake reads the launcher from the environment) and `actions/cache` keeps `~/.ccache`:
compiling C++ was about half of the 33-minute four-ABI release build, and unchanged C++ now
comes from the cache.

Metro serves the development build without lazy bundles (`metro.config.js`): lazily split
`import()`s of a package with `.cjs` and `.mjs` side by side asked for a module the split bundle
never defined. Release bundles never split, so development loads code the way the APK does.

Only `type-check`, `test` and `shellcheck` run in `moon ci`; the bundle, the APK and the e2e tests run in
the `native` and `native-e2e` CI jobs, which need Java and an emulator.

- `src/app` — Expo Router routes, thin files over the screens; `_layout.tsx` is the root.
- `src/composition-root.ts` — every adapter wired once: quick-crypto codec, SQLite stores,
  the fetch adapters of `@frozik/vault-http`, the phone's own adapters.
- `src/infrastructure` — `web-crypto` (installed by `polyfills.ts` before Expo Router),
  `kdf-quick-crypto`, `expo-sql-driver`, `app-state-lock-signals`, `native-clipboard`,
  `runtime-reload-wipe`, `secure-store-biometric-secrets`, `share-sheet-file-saver`,
  `document-picker`, `kdbx-reader`, `native-theme-store`, `single-process`, and
  `site-icon-pictures` (a served icon made a PNG by `expo-image-manipulator`),
  `google-drive-sign-in`, `ml-kit-qr-reader`, and `not-on-this-phone` for what the first
  release does without (passkeys, image compression).
- `src/ui` — the screens, a small kit on the brand's tokens
  (`@frozik/components/tokens/native-tokens`), contexts for the app, the open session and
  copy feedback.

## Signing key (the owner's runbook)

Done once, by the owner, on their own machine; the key never enters the repository.

0. `keytool` comes with a JDK: `brew install --cask temurin` on a Mac. Work in a folder outside
   the repository (`*.keystore` is ignored anyway).
1. `keytool -genkeypair -v -keystore ciphra-vault.keystore -alias ciphra-vault -keyalg RSA
   -keysize 4096 -validity 36500` — choose a strong store password and key password.
2. Keep two offline copies of the keystore and the passwords (a lost key means users must
   uninstall to update).
3. `base64 -i ciphra-vault.keystore | pbcopy`, then in the organization's repository add the
   secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
   `ANDROID_KEY_PASSWORD` to the `release` environment (required reviewer: the owner,
   deployments from `main` only).
4. Publish the certificate's SHA-256 (`keytool -list -v -keystore ciphra-vault.keystore`) in
   this README and in the organization's README — done for the current key; after the first
   release, confirm `apksigner verify --print-certs` on the published APK prints the same.
5. For Google Drive on a local build: keep the keystore at `~/ciphra-keys/ciphra-vault.keystore` (or point
   `$VAULT_KEYSTORE` at it; another alias in `$VAULT_KEY_ALIAS`) and put its password in the
   Keychain: `security add-generic-password -a "$USER" -s ciphra-vault-keystore -w`. Then
   `pnpm vault-android:dev` and `pnpm vault-android:e2e` sign the APK with it (`sign-apk.sh`),
   so Google accepts it as the registered Android client. Without the key the APK keeps the
   debug signature and Drive sign-in is refused. The first install after the key changes
   uninstalls the app signed with the other one, its vaults with it (`install-apk.sh`).
