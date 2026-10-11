# apple/password-manager-resources — pinned snapshot

- Repository: https://github.com/apple/password-manager-resources
- Commit: `2abb88fdc42ca827addb53b31cbb8debdb5b17f3` (2026-10-06)
- Files: `quirks/shared-credentials.json`, `quirks/change-password-URLs.json` (saved here as
  `change-password-urls.json`), `quirks/password-rules.json`, unchanged
- License: MIT, `LICENSE.md` next to this file
- Used by: `model/shared-credentials.ts`, `model/change-password-url.ts` (model.md §3.2),
  `generator/site-password-rules.ts` (features.md §3)

Updated only by a deliberate pull request: replace the files from a newer commit, update the
commit line above and review the diff. The data are hints (shared logins, where to change a
password), never security rules.
