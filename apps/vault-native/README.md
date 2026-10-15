# Ciphra Vault — the Android app

The password vault as an Android app. It renders the same application layer as the web app
and the portfolio's demo ([`libs/vault-app`](../../libs/vault-app/README.md)) with native
screens, and keeps only sealed `.pwv` files and sealed device records on the phone.

Built with Expo SDK 57 (React Native 0.86, the New Architecture, Hermes) and Expo Router.
There are no over-the-air updates: every change ships as a signed APK the user can verify.

## Screens

- **First run** — the vaults this phone knows (names and descriptions only), **Open from a
  cloud** (a WebDAV folder: Nextcloud, ownCloud, a NAS, rclone or a hosted service — a phone
  needs no CORS), **Open a vault file** (any `.pwv` from Files, Drive or a USB stick),
  **Create a vault** (on this phone, or in the folder the opening reached), the theme.
- **Unlock** — the master password, the recovery key, the fingerprint (only a strong,
  Class 3 sensor; the phone's class is shown), or a quick lock's PIN, pattern or four
  characters, once. As in Bitwarden, the quick code survives Android ending the app: the key is
  kept behind it in the Keystore (read once with the master password), until a wrong code, the
  end of its lifetime, **Lock completely** or "Ask for the master password after the app
  restarts". A key rotation or a new fingerprint turns biometric unlock off and says so.
  **All vaults** leads back to the list from every unlock and waiting state; a lock (which
  restarts the JavaScript runtime) comes back to that vault's unlock, not the first screen.
- **An open vault** — **All vaults**, the cloud's state and the lock on top (behind the quick
  code once one is set up, as Bitwarden locks; a long press locks completely) (the list marks the
  vault that is open); strips for a key changed on another device (the password follows it),
  a vault opened with the recovery key, keys changed elsewhere, and the biometric offer; the bottom tabs **Vault**,
  **Search**, **Audit** and **Settings**; sections and groups in a sheet; sort chips; the cards
  opened lately and the favourites in strips above a `FlashList`, each with the web's icon (a
  card number's network, the site's icon, the chosen Lucide icon in the card's colour, or the
  template's). A row's ⋯ (or a long press) copies a field without opening the card, or marks
  it (favourite, archive, trash); an empty vault offers a first card or an import.
- **A card** — secrets masked until shown, large type, copy with a haptic tick and a snackbar
  that counts down to the clearing, open a site, live TOTP / Steam codes and HOTP with "Next
  code", the bank-card face, expiry and password-age banners, linked cards, protected cards
  behind the master password, history with restore.
- **Editing** — the icon (automatic or one of the built-in ones, by group) and its colour,
  every field kind, a field's ⋯ to rename, move or remove it, tabs, the generator (the site's
  password rules first), attachments, the conflict dialog when another device saved the card.
- **Audit** — weak, reused, old and leaked passwords (the breach check is opt-in), expiring
  cards, two-factor available.
- **Settings** — theme, lock timeouts and the clipboard, quick unlock, biometrics,
  screenshots, the vault's name, the master password, the recovery key with a text Emergency
  Kit, a new key, the cloud, import (CSV, Bitwarden, SafeInCloud, CXF, KeePass, another
  `.pwv`) and export through the share sheet, removing the vault from the phone, about.
- **Everywhere** — every dialog closes with its X, a tap outside or back; forms give way to
  the keyboard (edge to edge, Android no longer resizes the window); a secret field can be
  shown while typing and hides itself again; back steps through the cloud wizard instead of
  leaving it; a pattern the system interrupts is dropped, never sent as the one quick try.
- **Updates** — a note when a newer release is out; below the published security floor the
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
- Biometric unlock keeps the vault's key in the Android Keystore behind `BiometricPrompt`
  (`expo-secure-store` with `requireAuthentication`); turning it on asks for the master
  password once more, because an open vault's key cannot be read out.
- Screenshots, screen recording and the app-switcher picture are blocked (`FLAG_SECURE`);
  a setting allows them for an open vault after a confirmation, never on the unlock screens.
- No WebView, no analytics, no custom URL scheme, HTTPS only. Site icons come from icon.horse or
  favicone.com, each domain once, and can be turned off in the settings.

### Weaker spots, said plainly

- **Memory.** A lock replaces the JavaScript runtime (`reloadAppAsync`): the old heap is
  freed, not zeroed. Strings — a typed password, a copied secret — cannot be wiped in
  JavaScript at all.
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
moon run vault-native:e2e-android             # the Maestro flows in e2e/ against it
```

Metro serves the development build without lazy bundles (`metro.config.js`): lazily split
`import()`s of a package with `.cjs` and `.mjs` side by side asked for a module the split bundle
never defined. Release bundles never split, so development loads code the way the APK does.

Only `type-check` and `test` run in `moon ci`; the bundle, the APK and the Maestro flows run in
the `native` and `native-e2e` CI jobs, which need Java and an emulator.

- `src/app` — Expo Router routes, thin files over the screens; `_layout.tsx` is the root.
- `src/composition-root.ts` — every adapter wired once: quick-crypto codec, SQLite stores,
  the fetch adapters of `@frozik/vault-http`, the phone's own adapters.
- `src/infrastructure` — `web-crypto` (installed by `polyfills.ts` before Expo Router),
  `kdf-quick-crypto`, `expo-sql-driver`, `app-state-lock-signals`, `native-clipboard`,
  `runtime-reload-wipe`, `secure-store-biometric-secrets`, `share-sheet-file-saver`,
  `document-picker`, `kdbx-reader`, `native-theme-store`, `single-process`, and
  `site-icon-pictures` (a served icon made a PNG by `expo-image-manipulator`),
  `not-on-this-phone` for what the first release does without (passkeys, Google sign-in,
  QR scanning, image compression).
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
