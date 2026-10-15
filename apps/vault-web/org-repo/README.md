# Ciphra Vault

A password manager that keeps nothing on a server: your vault is one encrypted file in your own
Google Drive or WebDAV folder, and every device opens it with your master password.

**Open the app:** <https://ciphra-vault.github.io/> — install it from the browser (Android:
"Install app"; iPhone: Share → Add to Home Screen). It works offline once opened.

**Chrome extension:** download the zip from the latest
[release](https://github.com/ciphra-vault/ciphra-vault.github.io/releases/latest), unzip it,
open `chrome://extensions`, turn on Developer mode and choose **Load unpacked**.

**Android app:** download `ciphra-vault-vX.Y.Z.apk` from the latest
[release](https://github.com/ciphra-vault/ciphra-vault.github.io/releases/latest) on the phone,
open it and allow installs from the browser for this install. Later releases install over it.

## What it protects

- The vault is sealed on your device (Argon2id, AES-256-GCM); the cloud and this site only ever
  see ciphertext. There is no account and no server of ours.
- The page loads no third-party script and no analytics; its Content Security Policy lists every
  address it may reach.
- It locks when idle or out of sight and wipes its memory by reloading; a copied secret is
  cleared from the clipboard.

What it cannot protect against: malware on your device, a compromised browser, someone who
learns your master password, or a password you lose without a recovery key.

## Keep a way back in

- Keep the vault in a cloud: a lost phone loses nothing.
- Make a **recovery key** (Settings → Recovery key) and keep its Emergency Kit PDF offline.
- Export a backup now and then (Settings → Export).

## Verify a download

Every release file carries a build provenance attestation:

```bash
gh attestation verify ciphra-vault-extension-vX.Y.Z.zip \
  -R ciphra-vault/ciphra-vault.github.io \
  --signer-workflow Frozik/portfolio/.github/workflows/vault-release.yml
```

`SHA256SUMS` lists every file's checksum; the SBOMs list every dependency.

The APK is signed with one key for every release. `apksigner verify --print-certs
ciphra-vault-vX.Y.Z.apk` must print this certificate SHA-256 digest:

```text
b2a0b977dfc8355d16147e938fac7e1154a4ed1f040445bc34b83d4df1e10b0b
```

## More

- [Privacy](https://ciphra-vault.github.io/privacy.html)
- [Security](SECURITY.md) · [Third-party notices](THIRD_PARTY_NOTICES.md)
- Source: [Frozik/portfolio](https://github.com/Frozik/portfolio) (`apps/vault-web`,
  `apps/vault-extension`, `libs/vault*`).
