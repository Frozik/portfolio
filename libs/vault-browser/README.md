# @frozik/vault-browser

The password vault's browser adapters, shared by the web renderers (the portfolio's vault,
the Ciphra Vault web app) and, where they fit, the extension: the codec, KeePass and
strength-meter workers, WebAuthn passkeys, Google Identity and Drive, WebDAV probing,
BroadcastChannel and Web Locks, the clipboard, page lock signals, the reload wipe,
OffscreenCanvas image work and QR reading, file saving, Have I Been Pwned and the 2FA
Directory. Each implements a port of `@frozik/vault-app`; a composition root wires them.

Ambient browser types it needs (`types/google-accounts.d.ts`,
`types/barcode-detector.d.ts`) are included by every program that compiles it.
